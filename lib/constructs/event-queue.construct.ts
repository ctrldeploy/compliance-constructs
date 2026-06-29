import { Duration } from 'aws-cdk-lib';
import {
    ComparisonOperator,
    MathExpression,
    Metric,
    TreatMissingData,
} from 'aws-cdk-lib/aws-cloudwatch';
import { Queue, QueueEncryption, type QueueProps } from 'aws-cdk-lib/aws-sqs';
import type { Construct } from 'constructs';
import { AlarmableUnambiguousConstruct } from './alarmable-unambiguous.construct';
import { BasicAlarm, type BasicAlarmConfig } from './basic-alarm.construct';
import { CompliantDLQ } from './dlq.construct';
import type { CompliantKey } from './key.construct';
import { type DisambiguationProps, getRemovalPolicy, type RemovalPolicyProps } from './props';

export interface CompliantQueueProps extends QueueProps, DisambiguationProps, RemovalPolicyProps {
    /** Optional customer-managed key. When supplied, the queue + its DLQ use SSE-KMS. */
    readonly encryptionKey?: CompliantKey;
    readonly maxReceiveCount?: number;
    readonly dlq?: CompliantDLQ;
    readonly sqsMessageDoesFlowAlarmConfig?: BasicAlarmConfig;
}

const DEFAULT_RETRY_ATTEMPTS = 5;
const DEFAULT_RETENTION_PERIOD = Duration.days(14);

/**
 * An SQS queue with SOC 2 safeguards baked in.
 *
 * Safeguards:
 *  - Server-side encryption (SSE-SQS by default, SSE-KMS with an `encryptionKey`) — AwsSolutions-SQS2.
 *  - A dead-letter queue is always attached — AwsSolutions-SQS3.
 *  - TLS enforced in transit via `enforceSSL` — AwsSolutions-SQS4.
 *  - 14-day retention and stage-driven removal policy.
 *  - Message-flow CloudWatch alarm.
 */
export class CompliantQueue extends AlarmableUnambiguousConstruct {
    public readonly dlq: CompliantDLQ;
    public readonly queue: Queue;
    public readonly queueName: string | undefined;
    public readonly deadLetterQueueName: string | undefined;

    private readonly props: CompliantQueueProps;

    constructor(scope: Construct, id: string, props: CompliantQueueProps) {
        super(scope, id, props.disambiguator);

        this.props = props;

        this.queueName = this.disambiguate(this.props.queueName);
        this.deadLetterQueueName = this.props.dlq?.queueName || `${this.queueName}-dlq`;

        this.dlq =
            this.props.dlq ||
            new CompliantDLQ(this, this.deadLetterQueueName, {
                ...this.props,
                queueName: this.deadLetterQueueName,
            });

        this.queue = new Queue(this, 'queue', {
            ...this.props,
            queueName: this.queueName,
            encryption:
                this.props.encryption ??
                (this.props.encryptionKey ? QueueEncryption.KMS : QueueEncryption.SQS_MANAGED),
            encryptionMasterKey: this.props.encryptionKey?.key,
            enforceSSL: this.props.enforceSSL ?? true,
            retentionPeriod: this.props.retentionPeriod || DEFAULT_RETENTION_PERIOD,
            removalPolicy: getRemovalPolicy(this.props),
            deadLetterQueue: {
                queue: this.dlq.queue,
                maxReceiveCount: this.props.maxReceiveCount || DEFAULT_RETRY_ATTEMPTS,
            },
        });

        if (this.queueName) {
            this.addAlarm(
                this.createSqsMessageDoesFlowAlarm(
                    this.queueName,
                    this.props.sqsMessageDoesFlowAlarmConfig,
                ),
            );
        }
    }

    private createSqsMessageDoesFlowAlarm(
        queueName: string,
        alarmConfig?: BasicAlarmConfig,
    ): BasicAlarm {
        return new BasicAlarm(this, 'message-does-flow-alarm', {
            ...this.props,
            metric: new MathExpression({
                expression: '100 * (messageReceived - messageDeleted) / messageReceived',
                usingMetrics: {
                    messageReceived: new Metric({
                        namespace: 'AWS/SQS',
                        dimensionsMap: {
                            QueueName: queueName,
                        },
                        metricName: 'NumberOfMessagesReceived',
                        region: this.props.region,
                    }),
                    messageDeleted: new Metric({
                        namespace: 'AWS/SQS',
                        dimensionsMap: {
                            QueueName: queueName,
                        },
                        metricName: 'NumberOfMessagesDeleted',
                        region: this.props.region,
                    }),
                },
                period: alarmConfig?.period || Duration.minutes(5),
                label: 'Message Flow Rate (in %)',
            }),
            threshold: alarmConfig?.threshold || 50.0,
            evaluationPeriods: alarmConfig?.evaluationPeriods || 1,
            comparisonOperator: ComparisonOperator.LESS_THAN_OR_EQUAL_TO_THRESHOLD,
            actionsEnabled: false,
            treatMissingData: TreatMissingData.NOT_BREACHING,
            alarmName: `${queueName}-message-do-flow-alarm`,
            isCritical: true,
        });
    }
}
