import type { Construct } from 'constructs';
import { suppressCdkManagedResources } from '../compliance/suppressions';
import { CompliantVpc } from '../constructs/vpc.construct';
import { UnambiguousStack, type UnambiguousStackProps } from './common/unambiguous.stack';

/**
 * Example network stack — deploys a {@link CompliantVpc} (flow logs + restricted
 * default security group).
 */
export class NetworkStack extends UnambiguousStack {
    public readonly vpc: CompliantVpc;

    constructor(scope: Construct, id: string, props: UnambiguousStackProps) {
        super(scope, id, props);

        this.vpc = new CompliantVpc(this, 'compliant-vpc', {
            disambiguator: props.disambiguator,
            stage: props.stage,
            region: props.region,
            account: props.account,
            developmentRemovalPolicy: props.developmentRemovalPolicy,
            productionRemovalPolicy: props.productionRemovalPolicy,
        });

        suppressCdkManagedResources(this);
    }
}
