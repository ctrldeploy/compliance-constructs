import { Duration } from 'aws-cdk-lib';
import { ComparisonOperator, Metric, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import { Queue, QueueEncryption, type QueueProps } from 'aws-cdk-lib/aws-sqs';
import type { Construct } from 'constructs';
import { AlarmableUnambiguousConstruct } from './alarmable-unambiguous.construct';
import { BasicAlarm, type BasicAlarmConfig } from './basic-alarm.construct';
import type { CompliantKey } from './key.construct';
import { type DisambiguationProps, getRemovalPolicy, type RemovalPolicyProps } from './props';

export interface CompliantDLQProps extends QueueProps, DisambiguationProps, RemovalPolicyProps {
    /** Optional customer-managed key. When supplied, the queue uses SSE-KMS instead of SSE-SQS. */
    readonly encryptionKey?: CompliantKey;
    readonly lowSeverityAlarmConfig?: BasicAlarmConfig;
    readonly highSeverityAlarmConfig?: BasicAlarmConfig;
}

const DEFAULT_RETENTION_PERIOD = Duration.days(14);

/**
 * A dead-letter SQS queue with SOC 2 safeguards baked in.
 *
 * Safeguards:
 *  - Server-side encryption (SSE-SQS by default, SSE-KMS with an `encryptionKey`) — AwsSolutions-SQS2.
 *  - TLS enforced in transit via `enforceSSL` — AwsSolutions-SQS4.
 *  - 14-day retention and stage-driven removal policy.
 *  - Optional depth alarms.
 */
export class CompliantDLQ extends AlarmableUnambiguousConstruct {
    public readonly queue: Queue;
    public readonly queueName: string | undefined;

    private readonly props: CompliantDLQProps;

    constructor(scope: Construct, id: string, props: CompliantDLQProps) {
        super(scope, id, props.disambiguator);

        this.props = props;

        const queueName = this.disambiguate(this.props.queueName);
        this.queue = new Queue(this, 'dlq', {
            ...this.props,
            encryption:
                this.props.encryption ??
                (this.props.encryptionKey ? QueueEncryption.KMS : QueueEncryption.SQS_MANAGED),
            encryptionMasterKey: this.props.encryptionKey?.key,
            enforceSSL: this.props.enforceSSL ?? true,
            retentionPeriod: this.props.retentionPeriod || DEFAULT_RETENTION_PERIOD,
            removalPolicy: getRemovalPolicy(this.props),
            queueName: queueName,
        });

        this.queueName = this.queue.queueName;

        if (this.props.lowSeverityAlarmConfig) {
            this.addAlarm(this.createDLQAlarm(this.queueName, this.props.lowSeverityAlarmConfig));
        }

        if (this.props.highSeverityAlarmConfig) {
            this.addAlarm(this.createDLQAlarm(this.queueName, this.props.highSeverityAlarmConfig));
        }
    }

    private createDLQAlarm(queueName: string, alarmConfig: BasicAlarmConfig): BasicAlarm {
        return new BasicAlarm(this, `dlq-${alarmConfig.severity}-alarm`, {
            ...this.props,
            metric: new Metric({
                namespace: 'AWS/SQS',
                dimensionsMap: {
                    QueueName: queueName,
                },
                metricName: 'ApproximateNumberOfMessagesVisible',
                region: this.props.region,
                period: alarmConfig.period || Duration.hours(8),
            }),
            threshold: alarmConfig.threshold,
            comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            evaluationPeriods: alarmConfig.evaluationPeriods,
            actionsEnabled: true,
            treatMissingData: TreatMissingData.NOT_BREACHING,
            alarmName: `DLQ-${queueName}-${alarmConfig.severity}-alarm`,
            isCritical: false,
        });
    }
}
