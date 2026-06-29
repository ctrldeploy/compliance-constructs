import { Duration, RemovalPolicy } from 'aws-cdk-lib';
import { ComparisonOperator, Metric, Stats, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import {
    BlockPublicAccess,
    Bucket,
    BucketEncryption,
    type BucketProps,
    type LifecycleRule,
    StorageClass,
} from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';
import { AlarmableUnambiguousConstruct } from './alarmable-unambiguous.construct';
import { BasicAlarm, type BasicAlarmConfig } from './basic-alarm.construct';
import type { CompliantKey } from './key.construct';
import { type DisambiguationProps, getRemovalPolicy, type RemovalPolicyProps } from './props';

export interface CompliantBucketProps
    extends Omit<BucketProps, 'encryptionKey'>,
        DisambiguationProps,
        RemovalPolicyProps {
    readonly bucket?: Bucket;
    /** Optional customer-managed key. When supplied, the bucket uses SSE-KMS instead of SSE-S3. */
    readonly encryptionKey?: CompliantKey;
    readonly errorRate4xxAlarmConfig?: BasicAlarmConfig;
    readonly errorRate5xxAlarmConfig?: BasicAlarmConfig;
    readonly serverAccessLogsBucket?: Bucket;
    readonly serverAccessLogsPrefix?: string;
}

/**
 * An S3 bucket with SOC 2 safeguards baked in.
 *
 * Safeguards:
 *  - Public access fully blocked (AwsSolutions-S2).
 *  - Encryption at rest: SSE-S3 by default, SSE-KMS when an `encryptionKey` is supplied.
 *  - TLS enforced in transit via `enforceSSL` (AwsSolutions-S5 / S10).
 *  - Object versioning enabled by default.
 *  - Server access logging when a `serverAccessLogsBucket` is supplied (AwsSolutions-S1).
 *  - Noncurrent-version lifecycle (Intelligent-Tiering @30d, expiry @90d).
 *  - 4xx/5xx CloudWatch error alarms.
 */
export class CompliantBucket extends AlarmableUnambiguousConstruct {
    public readonly bucket: Bucket;
    public readonly bucketName: string | undefined;

    private readonly props: CompliantBucketProps;

    constructor(scope: Construct, name: string, props: CompliantBucketProps) {
        super(scope, name, props.disambiguator);
        this.props = props;

        const removalPolicy = getRemovalPolicy(this.props);
        const autoDeleteObjects = removalPolicy === RemovalPolicy.DESTROY;
        const additionalDimensions = [this.props.stage, this.props.region];

        const defaultLifecycleRules: LifecycleRule[] = [
            {
                noncurrentVersionTransitions: [
                    {
                        storageClass: StorageClass.INTELLIGENT_TIERING,
                        transitionAfter: Duration.days(30),
                    },
                ],
                noncurrentVersionExpiration: Duration.days(90),
            },
        ];

        const encryption = this.props.encryptionKey
            ? BucketEncryption.KMS
            : BucketEncryption.S3_MANAGED;

        this.bucketName =
            this.props.bucket?.bucketName ||
            this.disambiguate(this.props.bucketName, additionalDimensions);
        this.bucket =
            this.props.bucket ||
            new Bucket(this, 'bucket', {
                ...this.props,
                bucketName: this.bucketName,
                removalPolicy: removalPolicy,
                autoDeleteObjects: autoDeleteObjects,
                serverAccessLogsBucket: this.props.serverAccessLogsBucket,
                serverAccessLogsPrefix: this.props.serverAccessLogsPrefix,
                versioned: this.props.versioned ?? true,
                lifecycleRules: this.props.lifecycleRules ?? defaultLifecycleRules,
                blockPublicAccess: this.props.blockPublicAccess ?? BlockPublicAccess.BLOCK_ALL,
                encryption: this.props.encryption ?? encryption,
                encryptionKey: this.props.encryptionKey?.key,
                bucketKeyEnabled: this.props.encryptionKey ? true : this.props.bucketKeyEnabled,
                enforceSSL: this.props.enforceSSL ?? true,
            });

        if (this.bucketName !== undefined) {
            this.addAlarm(
                this.createS3ErrorCountAlarm(
                    this.bucketName,
                    '4xxErrors',
                    this.props.errorRate4xxAlarmConfig,
                ),
            );
            this.addAlarm(
                this.createS3ErrorCountAlarm(
                    this.bucketName,
                    '5xxErrors',
                    this.props.errorRate5xxAlarmConfig,
                ),
            );
        }
    }

    private createS3ErrorCountAlarm(
        s3BucketName: string,
        errorType: string,
        alarmConfig?: BasicAlarmConfig,
    ) {
        return new BasicAlarm(this, `error-count-alarm-${errorType}`, {
            ...this.props,
            metric: new Metric({
                namespace: 'AWS/S3',
                dimensionsMap: {
                    BucketName: s3BucketName,
                    FilterId: 'EntireBucket',
                },
                metricName: errorType,
                statistic: Stats.SUM,
                region: this.props.region,
                period: alarmConfig?.period || Duration.minutes(1),
            }),
            threshold: alarmConfig?.threshold || 0,
            comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            evaluationPeriods: alarmConfig?.evaluationPeriods || 1,
            actionsEnabled: false,
            treatMissingData: TreatMissingData.NOT_BREACHING,
            isCritical: true,
        });
    }
}
