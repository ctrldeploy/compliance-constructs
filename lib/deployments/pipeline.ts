import { type App, RemovalPolicy, Stage, type StageProps } from 'aws-cdk-lib';
import {
    AWS_ACCOUNT,
    DEV_REGION,
    type DeploymentConfig,
    PROD_REGION,
    PROD_STAGE,
    STAGING_STAGE,
} from '../config/deployment.config';
import { DEV, PROD, STAGING } from '../config/stages';
import type { DisambiguationProps, RemovalPolicyProps } from '../constructs/props';
import { ApiStack } from '../stacks/api.stack';
import { ComputeStack } from '../stacks/compute.stack';
import { MessagingStack } from '../stacks/messaging.stack';
import { NetworkStack } from '../stacks/network.stack';
import { StorageStack } from '../stacks/storage.stack';

export interface ExampleStageProps extends StageProps {
    readonly deploymentConfig: DeploymentConfig;
}

/**
 * Example deployment stage that instantiates every compliant construct via five
 * focused stacks (network, storage, messaging, compute, api). The whole stage is
 * assessed by the cdk-nag AwsSolutions aspect attached at App scope in `app.ts`.
 */
export class ExampleStage extends Stage {
    public readonly networkStack: NetworkStack;
    public readonly storageStack: StorageStack;
    public readonly messagingStack: MessagingStack;
    public readonly computeStack: ComputeStack;
    public readonly apiStack: ApiStack;

    constructor(scope: App, id: string, props: ExampleStageProps) {
        super(scope, id, props);

        const { deploymentConfig } = props;
        const isProduction = deploymentConfig.stage === PROD;

        const disambiguation: DisambiguationProps = {
            disambiguator:
                deploymentConfig.stage === DEV ? process.env.USER || 'dev' : deploymentConfig.stage,
            stage: deploymentConfig.stage,
            region: deploymentConfig.region,
            account: deploymentConfig.account,
        };

        const removal: RemovalPolicyProps = {
            developmentRemovalPolicy: RemovalPolicy.DESTROY,
            productionRemovalPolicy: isProduction ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
            stage: deploymentConfig.stage,
        };

        const base = { ...disambiguation, ...removal };

        this.networkStack = new NetworkStack(this, 'network-stack', {
            ...base,
            stackName: 'network',
        });
        this.storageStack = new StorageStack(this, 'storage-stack', {
            ...base,
            stackName: 'storage',
        });
        this.messagingStack = new MessagingStack(this, 'messaging-stack', {
            ...base,
            stackName: 'messaging',
        });
        this.computeStack = new ComputeStack(this, 'compute-stack', {
            ...base,
            stackName: 'compute',
        });
        this.apiStack = new ApiStack(this, 'api-stack', { ...base, stackName: 'api' });
    }
}

/** Deploy a personal/sandbox copy of the example (DEV stage). */
export function deployPersonal(app: App, user: string): App {
    new ExampleStage(app, user, {
        env: { account: AWS_ACCOUNT, region: DEV_REGION },
        deploymentConfig: { account: AWS_ACCOUNT, region: DEV_REGION, stage: DEV, isProd: false },
    });
    return app;
}

/** Deploy the staging copy of the example. */
export function deployStaging(app: App): App {
    new ExampleStage(app, STAGING, {
        env: { account: AWS_ACCOUNT, region: STAGING_STAGE.region },
        deploymentConfig: STAGING_STAGE,
    });
    return app;
}

/** Deploy the production copy of the example. */
export function deployProduction(app: App): App {
    new ExampleStage(app, PROD, {
        env: { account: AWS_ACCOUNT, region: PROD_REGION },
        deploymentConfig: PROD_STAGE,
    });
    return app;
}
