import { Code, Runtime } from 'aws-cdk-lib/aws-lambda';
import type { Construct } from 'constructs';
import { suppressCdkManagedResources } from '../compliance/suppressions';
import { CompliantFunction } from '../constructs/lambda.construct';
import { CompliantScheduledLambda } from '../constructs/scheduled-lambda.construct';
import { UnambiguousStack, type UnambiguousStackProps } from './common/unambiguous.stack';

const INLINE_HANDLER = 'exports.handler = async () => ({ statusCode: 200 });';

/**
 * Example compute stack — deploys a {@link CompliantFunction} and a
 * {@link CompliantScheduledLambda} (least-privilege role, X-Ray tracing,
 * encrypted log group, DLQ-backed schedule).
 */
export class ComputeStack extends UnambiguousStack {
    public readonly fn: CompliantFunction;
    public readonly scheduled: CompliantScheduledLambda;

    constructor(scope: Construct, id: string, props: UnambiguousStackProps) {
        super(scope, id, props);

        const base = {
            disambiguator: props.disambiguator,
            stage: props.stage,
            region: props.region,
            account: props.account,
            developmentRemovalPolicy: props.developmentRemovalPolicy,
            productionRemovalPolicy: props.productionRemovalPolicy,
        };

        this.fn = new CompliantFunction(this, 'worker', {
            ...base,
            functionName: 'compliant-worker',
            runtime: Runtime.NODEJS_22_X,
            handler: 'index.handler',
            code: Code.fromInline(INLINE_HANDLER),
        });

        this.scheduled = new CompliantScheduledLambda(this, 'scheduled-worker', {
            ...base,
            lambdaFunctionName: 'compliant-scheduled-worker',
            scheduleName: 'compliant-schedule',
            scheduleExpression: 'rate(1 hour)',
            lambdaProps: {
                runtime: Runtime.NODEJS_22_X,
                handler: 'index.handler',
                code: Code.fromInline(INLINE_HANDLER),
            },
        });

        suppressCdkManagedResources(this);
    }
}
