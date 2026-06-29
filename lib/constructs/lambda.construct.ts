import { Duration } from 'aws-cdk-lib';
import {
    ComparisonOperator,
    MathExpression,
    Metric,
    Stats,
    TreatMissingData,
} from 'aws-cdk-lib/aws-cloudwatch';
import { type IRole, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import {
    Architecture,
    type FunctionProps,
    Function as LambdaFunction,
    Tracing,
} from 'aws-cdk-lib/aws-lambda';
import { LogGroup, MetricFilter, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { NagSuppressions } from 'cdk-nag';
import type { Construct } from 'constructs';
import { AlarmableUnambiguousConstruct } from './alarmable-unambiguous.construct';
import { BasicAlarm, type BasicAlarmConfig } from './basic-alarm.construct';
import { type DisambiguationProps, getRemovalPolicy, type RemovalPolicyProps } from './props';

export interface CompliantFunctionProps
    extends FunctionProps,
        DisambiguationProps,
        RemovalPolicyProps {
    readonly lambdaFunction?: LambdaFunction;
    readonly role?: Role;
    /** Log retention for the function's encrypted log group. @default RetentionDays.ONE_YEAR */
    readonly logRetention?: RetentionDays;

    readonly errorCountAlarmConfig?: BasicAlarmConfig;
    readonly errorRateAlarmConfig?: BasicAlarmConfig;
    readonly throttlingAlarmConfig?: BasicAlarmConfig;
    readonly memoryUtilizationAlarmConfig?: BasicAlarmConfig;
    readonly durationAlarmConfig?: BasicAlarmConfig;
    readonly invocationCountAlarmConfig?: BasicAlarmConfig;
}

/**
 * A Lambda function with SOC 2 safeguards baked in.
 *
 * Safeguards:
 *  - Least-privilege execution role: a dedicated, pre-created log group with
 *    scoped `grantWrite` instead of the broad AWS-managed basic-execution policy.
 *  - Active X-Ray tracing for observability.
 *  - Encrypted CloudWatch log group with explicit retention.
 *  - ARM64 architecture.
 *  - Error / duration / throttle / memory CloudWatch alarms.
 *
 * Environment variables are entirely caller-supplied; the construct injects no
 * business configuration. The runtime is caller-supplied — keep it current to
 * satisfy AwsSolutions-L1.
 */
export class CompliantFunction extends AlarmableUnambiguousConstruct {
    public readonly function: LambdaFunction;
    public readonly role: IRole;
    public readonly logGroup: LogGroup;
    public readonly functionName: string | undefined;
    public readonly roleName: string | undefined;

    private readonly props: CompliantFunctionProps;

    constructor(scope: Construct, id: string, props: CompliantFunctionProps) {
        super(scope, id, props.disambiguator);

        this.props = props;

        this.functionName =
            this.props.lambdaFunction?.functionName || this.disambiguate(this.props.functionName);
        this.roleName = this.props.role?.roleName || `${this.functionName}-role`;

        this.role =
            this.props.role ||
            new Role(this, 'role', {
                roleName: this.roleName,
                assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
            });

        // Pre-create an encrypted, retention-bound log group and grant the role
        // scoped write access (least privilege — avoids the broad managed policy).
        this.logGroup = new LogGroup(this, 'log-group', {
            logGroupName: this.functionName ? `/aws/lambda/${this.functionName}` : undefined,
            retention: this.props.logRetention ?? RetentionDays.ONE_YEAR,
            removalPolicy: getRemovalPolicy(this.props),
        });
        this.logGroup.grantWrite(this.role);

        this.function =
            this.props.lambdaFunction ||
            new LambdaFunction(this, 'function', {
                ...props,
                functionName: this.functionName,
                tracing: props.tracing ?? Tracing.ACTIVE,
                architecture: props.architecture ?? Architecture.ARM_64,
                role: this.role,
                logGroup: this.logGroup,
            });

        // X-Ray's PutTraceSegments/PutTelemetryRecords only support a "*" resource;
        // active tracing attaches the AWS-recommended managed policy for it.
        NagSuppressions.addResourceSuppressions(
            this.role,
            [
                {
                    id: 'AwsSolutions-IAM4',
                    reason: 'Active X-Ray tracing attaches the AWS-managed AWSXRayDaemonWriteAccess policy; X-Ray write actions are not resource-scopable and this is the AWS-recommended baseline for tracing (SOC 2 observability).',
                },
                {
                    id: 'AwsSolutions-IAM5',
                    reason: 'X-Ray PutTraceSegments / PutTelemetryRecords only accept a "*" resource by AWS design; the wildcard is intrinsic to the action, not over-broad access.',
                },
            ],
            true,
        );

        if (this.functionName) {
            new MetricFilter(this, `MetricFilter-${this.functionName}-MaxMemoryUsed`, {
                metricName: `${this.functionName}-MaxMemoryUsed`,
                metricNamespace: 'ApplicationService/Lambda',
                logGroup: this.logGroup,
                filterPattern: {
                    logPatternString:
                        '[report_name="REPORT", request_id_name="RequestId:", request_id_value,duration_name="Duration:", duration_value, duration_unit="ms",billed_duration_name_1="Billed",bill_duration_name_2="Duration:", billed_duration_value, billed_duration_unit="ms",memory_size_name_1="Memory", memory_size_name_2="Size:", memory_size_value, memory_size_unit="MB", max_memory_used_name_1="Max", max_memory_used_name_2="Memory", max_memory_used_name_3="Used:", max_memory_used_value, ...]',
                },
                metricValue: '$max_memory_used_value',
            });

            new MetricFilter(this, `MetricFilter-${this.functionName}-MaxMemorySize`, {
                metricName: `${this.functionName}-MaxMemorySize`,
                metricNamespace: 'ApplicationService/Lambda',
                logGroup: this.logGroup,
                filterPattern: {
                    logPatternString:
                        '[report_name="REPORT", request_id_name="RequestId:", request_id_value,duration_name="Duration:", duration_value, duration_unit="ms",billed_duration_name_1="Billed",bill_duration_name_2="Duration:", billed_duration_value, billed_duration_unit="ms",memory_size_name_1="Memory", memory_size_name_2="Size:", memory_size_value, memory_size_unit="MB", max_memory_used_name_1="Max", max_memory_used_name_2="Memory", max_memory_used_name_3="Used:", max_memory_used_value, ...]',
                },
                metricValue: '$memory_size_value',
            });

            this.addAlarm(
                this.createLambdaMemoryUtilizationAlarm(
                    this.functionName,
                    this.props.memoryUtilizationAlarmConfig,
                ),
            );
            this.addAlarm(
                this.createLambdaErrorCountAlarm(
                    this.functionName,
                    this.props.errorCountAlarmConfig,
                ),
            );

            if (this.props.invocationCountAlarmConfig) {
                this.addAlarm(
                    this.createLambdaInvocationAlarm(
                        this.functionName,
                        this.props.invocationCountAlarmConfig,
                    ),
                );
            }

            if (this.props.durationAlarmConfig) {
                this.addAlarm(
                    this.createLambdaDurationAlarm(
                        this.functionName,
                        this.props.durationAlarmConfig,
                    ),
                );
            }

            if (this.props.throttlingAlarmConfig) {
                this.addAlarm(
                    this.createLambdaThrottleRateAlarm(
                        this.functionName,
                        this.props.throttlingAlarmConfig,
                    ),
                );
            }

            if (this.props.errorRateAlarmConfig) {
                this.addAlarm(
                    this.createLambdaErrorRateAlarm(
                        this.functionName,
                        this.props.errorRateAlarmConfig,
                    ),
                );
            }
        }
    }

    private createLambdaMemoryUtilizationAlarm(
        functionName: string,
        alarmConfig?: BasicAlarmConfig,
    ) {
        return new BasicAlarm(this, 'memory-utilization-alarm', {
            ...this.props,
            metric: new MathExpression({
                expression: 'memoryUsed*100/memorySize',
                usingMetrics: {
                    memoryUsed: new Metric({
                        namespace: 'AWS/Lambda',
                        metricName: `${this.functionName}-MaxMemoryUsed`,
                        region: this.props.region,
                    }),
                    memorySize: new Metric({
                        namespace: 'ApplicationService/Lambda',
                        metricName: `${this.functionName}-MaxMemorySize`,
                        region: this.props.region,
                    }),
                },
                period: alarmConfig?.period || Duration.minutes(1),
                label: 'Rates (in %)',
            }),
            threshold: alarmConfig?.threshold || 80.0,
            evaluationPeriods: alarmConfig?.evaluationPeriods || 3,
            actionsEnabled: false,
            treatMissingData: TreatMissingData.NOT_BREACHING,
            alarmName: `${functionName} Memory Utilization Rate`,
            isCritical: true,
        });
    }

    private createLambdaErrorCountAlarm(functionName: string, alarmConfig?: BasicAlarmConfig) {
        return new BasicAlarm(this, 'error-count-alarm', {
            ...this.props,
            metric: new Metric({
                namespace: 'AWS/Lambda',
                dimensionsMap: {
                    FunctionName: functionName,
                },
                metricName: `${this.functionName}-Errors`,
                statistic: Stats.SUM,
                region: this.props.region,
                period: alarmConfig?.period || Duration.minutes(1),
            }),
            threshold: alarmConfig?.threshold || 1.0,
            comparisonOperator: ComparisonOperator.GREATER_THAN_THRESHOLD,
            evaluationPeriods: alarmConfig?.evaluationPeriods || 1,
            actionsEnabled: false,
            treatMissingData: TreatMissingData.NOT_BREACHING,
            alarmName: `${functionName} Lambda Error Count`,
            isCritical: false,
        });
    }

    private createLambdaInvocationAlarm(functionName: string, alarmConfig: BasicAlarmConfig) {
        return new BasicAlarm(this, 'invocation-alarm', {
            ...this.props,
            metric: new Metric({
                namespace: 'AWS/Lambda',
                dimensionsMap: {
                    FunctionName: functionName,
                },
                metricName: `${this.functionName}-Invocations`,
                statistic: Stats.SUM,
                region: this.props.region,
                period: alarmConfig.period || Duration.days(1),
            }),
            threshold: alarmConfig.threshold,
            comparisonOperator: ComparisonOperator.LESS_THAN_THRESHOLD,
            evaluationPeriods: alarmConfig.evaluationPeriods,
            actionsEnabled: false,
            treatMissingData: TreatMissingData.BREACHING,
            alarmName: `${functionName} Invocation`,
            isCritical: true,
        });
    }

    private createLambdaDurationAlarm(functionName: string, alarmConfig: BasicAlarmConfig) {
        return new BasicAlarm(this, 'duration-alarm', {
            ...this.props,
            metric: new Metric({
                namespace: 'AWS/Lambda',
                dimensionsMap: {
                    FunctionName: functionName,
                },
                metricName: `${this.functionName}-Duration`,
                statistic: 'p99',
                region: this.props.region,
                period: alarmConfig.period || Duration.minutes(1),
            }),
            threshold: alarmConfig.threshold,
            evaluationPeriods: alarmConfig.evaluationPeriods,
            actionsEnabled: false,
            treatMissingData: TreatMissingData.NOT_BREACHING,
            alarmName: `${functionName} Lambda Duration`,
            isCritical: true,
        });
    }

    private createLambdaThrottleRateAlarm(functionName: string, alarmConfig: BasicAlarmConfig) {
        return new BasicAlarm(this, `throttle-rate-alarm-sev-${alarmConfig.severity.toString()}`, {
            ...this.props,
            metric: new MathExpression({
                expression: 'throttles*100/invocations',
                usingMetrics: {
                    throttles: new Metric({
                        namespace: 'AWS/Lambda',
                        dimensionsMap: {
                            FunctionName: functionName,
                        },
                        metricName: `${this.functionName}-Throttles`,
                        region: this.props.region,
                    }),
                    invocations: new Metric({
                        namespace: 'AWS/Lambda',
                        dimensionsMap: {
                            FunctionName: functionName,
                        },
                        metricName: `${this.functionName}-Invocations`,
                        region: this.props.region,
                    }),
                },
                period: alarmConfig.period || Duration.minutes(1),
                label: 'Rates (in %)',
            }),
            threshold: alarmConfig.threshold,
            evaluationPeriods: alarmConfig.evaluationPeriods,
            actionsEnabled: false,
            treatMissingData: TreatMissingData.NOT_BREACHING,
            alarmName: `${functionName} Throttle Rate`,
            isCritical: true,
        });
    }

    private createLambdaErrorRateAlarm(functionName: string, alarmConfig: BasicAlarmConfig) {
        return new BasicAlarm(this, 'error-rate-alarm', {
            ...this.props,
            metric: new MathExpression({
                expression: 'errors*100/invocations',
                usingMetrics: {
                    errors: new Metric({
                        namespace: 'AWS/Lambda',
                        dimensionsMap: {
                            FunctionName: functionName,
                        },
                        metricName: `${this.functionName}-Errors`,
                        region: this.props.region,
                    }),
                    invocations: new Metric({
                        namespace: 'AWS/Lambda',
                        dimensionsMap: {
                            FunctionName: functionName,
                        },
                        metricName: `${this.functionName}-Invocations`,
                        region: this.props.region,
                    }),
                },
                period: alarmConfig.period || Duration.minutes(1),
                label: 'Rates (in %)',
            }),
            threshold: alarmConfig.threshold,
            evaluationPeriods: alarmConfig.evaluationPeriods,
            actionsEnabled: false,
            treatMissingData: TreatMissingData.NOT_BREACHING,
            alarmName: `${functionName} Error Rate`,
            isCritical: true,
        });
    }
}
