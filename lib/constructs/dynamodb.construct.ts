import { Duration } from 'aws-cdk-lib';
import { ComparisonOperator, Metric, TreatMissingData } from 'aws-cdk-lib/aws-cloudwatch';
import {
    AttributeType,
    BillingMode,
    Table,
    TableClass,
    TableEncryption,
    type TableProps,
} from 'aws-cdk-lib/aws-dynamodb';
import type { Construct } from 'constructs';
import { AlarmableUnambiguousConstruct } from './alarmable-unambiguous.construct';
import { BasicAlarm, type BasicAlarmConfig } from './basic-alarm.construct';
import type { CompliantKey } from './key.construct';
import { type DisambiguationProps, getRemovalPolicy, type RemovalPolicyProps } from './props';

export interface CompliantTableProps
    extends Omit<Partial<TableProps>, 'encryptionKey'>,
        DisambiguationProps,
        RemovalPolicyProps {
    readonly table?: Table;
    /** Optional customer-managed key. When supplied, the table uses CUSTOMER_MANAGED encryption. */
    readonly encryptionKey?: CompliantKey;
    /** Whether the system-error alarm should trigger actions. @default false */
    readonly alarmActionsEnabled?: boolean;
    readonly systemErrorAlarmConfig?: BasicAlarmConfig;
}

/**
 * A DynamoDB table with SOC 2 safeguards baked in.
 *
 * Safeguards:
 *  - Point-in-time recovery enabled (AwsSolutions-DDB3).
 *  - Encryption at rest: AWS-managed by default, customer-managed when an `encryptionKey` is supplied.
 *  - On-demand (PAY_PER_REQUEST) billing.
 *  - Removal policy driven by stage (RETAIN in production).
 *  - System-error CloudWatch alarm.
 */
export class CompliantTable extends AlarmableUnambiguousConstruct {
    public readonly table: Table;
    public readonly tableName: string | undefined;

    private readonly props: CompliantTableProps;

    constructor(scope: Construct, id: string, props: CompliantTableProps) {
        super(scope, id, props.disambiguator);

        this.props = props;

        this.tableName = this.props.table?.tableName || this.disambiguate(this.props.tableName);

        const encryption = this.props.encryptionKey
            ? TableEncryption.CUSTOMER_MANAGED
            : TableEncryption.AWS_MANAGED;

        this.table =
            this.props.table ||
            new Table(this, 'table', {
                ...this.props,
                partitionKey: this.props.partitionKey ?? {
                    name: 'pk',
                    type: AttributeType.STRING,
                },
                billingMode: this.props.billingMode ?? BillingMode.PAY_PER_REQUEST,
                tableClass: this.props.tableClass ?? TableClass.STANDARD,
                encryption: this.props.encryption ?? encryption,
                encryptionKey: this.props.encryptionKey?.key,
                pointInTimeRecoverySpecification: this.props.pointInTimeRecoverySpecification ?? {
                    pointInTimeRecoveryEnabled: true,
                },
                removalPolicy: getRemovalPolicy(this.props),
                tableName: this.tableName,
            });

        if (this.tableName) {
            this.addAlarm(
                this.createSystemErrorAlarm(this.tableName, this.props.systemErrorAlarmConfig),
            );
        }
    }

    private createSystemErrorAlarm(tableName: string, alarmConfig?: BasicAlarmConfig): BasicAlarm {
        return new BasicAlarm(this, 'system-error-alarm', {
            ...this.props,
            metric: new Metric({
                namespace: 'AWS/DynamoDB',
                dimensionsMap: {
                    TableName: tableName,
                },
                metricName: 'SystemErrors',
                region: this.props.region,
                period: alarmConfig?.period || Duration.minutes(1),
            }),
            threshold: alarmConfig?.threshold || 1.0,
            comparisonOperator: ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            evaluationPeriods: alarmConfig?.evaluationPeriods || 1,
            treatMissingData: TreatMissingData.NOT_BREACHING,
            alarmName: `DynamoDB-${tableName}-SystemErrors`,
            actionsEnabled: this.props.alarmActionsEnabled ?? false,
            isCritical: true,
        });
    }
}
