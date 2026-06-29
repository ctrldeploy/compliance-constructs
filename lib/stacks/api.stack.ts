import type { Construct } from 'constructs';
import { suppressCdkManagedResources } from '../compliance/suppressions';
import { CompliantApi } from '../constructs/api.construct';
import { UnambiguousStack, type UnambiguousStackProps } from './common/unambiguous.stack';

/**
 * Example API stack — deploys a {@link CompliantApi} (access + execution logging,
 * request validation, IAM authorization, WAF-associated stage).
 */
export class ApiStack extends UnambiguousStack {
    public readonly api: CompliantApi;

    constructor(scope: Construct, id: string, props: UnambiguousStackProps) {
        super(scope, id, props);

        this.api = new CompliantApi(this, 'compliant-api', {
            disambiguator: props.disambiguator,
            stage: props.stage,
            region: props.region,
            account: props.account,
            developmentRemovalPolicy: props.developmentRemovalPolicy,
            productionRemovalPolicy: props.productionRemovalPolicy,
            restApiName: 'compliant-api',
        });

        suppressCdkManagedResources(this);
    }
}
