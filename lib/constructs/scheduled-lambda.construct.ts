import { Effect, PolicyStatement, Role, ServicePrincipal } from 'aws-cdk-lib/aws-iam';
import * as scheduler from 'aws-cdk-lib/aws-scheduler';
import type { Construct } from 'constructs';
import { CompliantDLQ } from './dlq.construct';
import { CompliantFunction, type CompliantFunctionProps } from './lambda.construct';
import { type DisambiguationProps, disambiguate, type RemovalPolicyProps } from './props';
import { UnambiguousConstruct } from './unambiguous.construct';

export interface CompliantScheduledLambdaProps extends DisambiguationProps, RemovalPolicyProps {
    /** Lambda configuration properties (sans disambiguation/removal props, which are inherited). */
    readonly lambdaProps: Omit<
        CompliantFunctionProps,
        keyof DisambiguationProps | keyof RemovalPolicyProps
    >;

    /** Lambda function name (will be disambiguated). */
    readonly lambdaFunctionName: string;

    /** Environment variables for the Lambda function. */
    readonly environment?: Record<string, string>;

    /** Schedule expression (e.g., "rate(1 hour)", "cron(0 12 * * ? *)"). */
    readonly scheduleExpression: string;

    /** Name for the schedule (will be disambiguated). */
    readonly scheduleName: string;

    /** Description for the schedule. */
    readonly description?: string;

    /** Maximum window in minutes for flexible scheduling. @default 5 */
    readonly maximumWindowInMinutes?: number;

    /** Maximum retry attempts for failed invocations. @default 3 */
    readonly maximumRetryAttempts?: number;

    /** Schedule expression timezone. @default 'UTC' */
    readonly scheduleExpressionTimezone?: string;

    /** Whether the schedule should be enabled initially. @default true */
    readonly enabled?: boolean;

    /** Optional input payload to pass to the Lambda function. */
    readonly inputPayload?: Record<string, unknown>;

    /** Optional DLQ name override (will be disambiguated). */
    readonly dlqName?: string;

    /** Optional execution role name override (will be disambiguated). */
    readonly executionRoleName?: string;
}

/**
 * An EventBridge Scheduler -> Lambda pairing with SOC 2 safeguards baked in.
 *
 * Composes a {@link CompliantFunction} (least-privilege role, tracing, encrypted
 * logs) with a {@link CompliantDLQ} for failed invocations and a scheduler
 * execution role scoped to exactly the target function and DLQ ARNs.
 */
export class CompliantScheduledLambda extends UnambiguousConstruct {
    public readonly schedule: scheduler.CfnSchedule;
    public readonly executionRole: Role;
    public readonly deadLetterQueue: CompliantDLQ;
    public readonly lambda: CompliantFunction;

    constructor(scope: Construct, id: string, props: CompliantScheduledLambdaProps) {
        super(scope, id, props.disambiguator);

        this.lambda = new CompliantFunction(this, props.lambdaFunctionName, {
            ...props.lambdaProps,
            disambiguator: props.disambiguator,
            stage: props.stage,
            region: props.region,
            account: props.account,
            developmentRemovalPolicy: props.developmentRemovalPolicy,
            productionRemovalPolicy: props.productionRemovalPolicy,
            functionName: props.lambdaFunctionName,
            environment: props.environment,
        });

        const dlqName = disambiguate(
            props.dlqName || `${props.scheduleName}-dlq`,
            props.disambiguator,
        );
        this.deadLetterQueue = new CompliantDLQ(this, dlqName || `${props.scheduleName}-dlq`, {
            disambiguator: props.disambiguator,
            stage: props.stage,
            region: props.region,
            account: props.account,
            developmentRemovalPolicy: props.developmentRemovalPolicy,
            productionRemovalPolicy: props.productionRemovalPolicy,
            queueName: dlqName || `${props.scheduleName}-dlq`,
        });

        const executionRoleName = disambiguate(
            props.executionRoleName || `${props.scheduleName}-scheduler-role`,
            props.disambiguator,
        );
        this.executionRole = new Role(
            this,
            executionRoleName || `${props.scheduleName}-scheduler-role`,
            {
                assumedBy: new ServicePrincipal('scheduler.amazonaws.com'),
                description: `Role for EventBridge Scheduler to invoke ${props.scheduleName} Lambda`,
                roleName: executionRoleName || `${props.scheduleName}-scheduler-role`,
            },
        );

        this.executionRole.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['lambda:InvokeFunction'],
                resources: [this.lambda.function.functionArn],
            }),
        );

        this.executionRole.addToPolicy(
            new PolicyStatement({
                effect: Effect.ALLOW,
                actions: ['sqs:SendMessage'],
                resources: [this.deadLetterQueue.queue.queueArn],
            }),
        );

        const scheduleResourceName = disambiguate(props.scheduleName, props.disambiguator);
        const scheduleName = `${props.scheduleName}-${props.disambiguator || 'default'}`;

        const defaultInput = {
            source: 'eventbridge-scheduler',
            scheduleName: props.scheduleName,
        };
        const inputPayload = props.inputPayload
            ? { ...defaultInput, ...props.inputPayload }
            : defaultInput;

        this.schedule = new scheduler.CfnSchedule(
            this,
            scheduleResourceName || props.scheduleName,
            {
                name: scheduleName,
                description:
                    props.description || `Triggers the ${props.scheduleName} Lambda on a schedule`,
                scheduleExpression: props.scheduleExpression,
                flexibleTimeWindow: {
                    mode: 'FLEXIBLE',
                    maximumWindowInMinutes: props.maximumWindowInMinutes || 5,
                },
                target: {
                    arn: this.lambda.function.functionArn,
                    roleArn: this.executionRole.roleArn,
                    retryPolicy: {
                        maximumRetryAttempts: props.maximumRetryAttempts || 3,
                    },
                    deadLetterConfig: {
                        arn: this.deadLetterQueue.queue.queueArn,
                    },
                    input: JSON.stringify(inputPayload),
                },
                scheduleExpressionTimezone: props.scheduleExpressionTimezone || 'UTC',
                state: props.enabled !== false ? 'ENABLED' : 'DISABLED',
            },
        );
    }
}
