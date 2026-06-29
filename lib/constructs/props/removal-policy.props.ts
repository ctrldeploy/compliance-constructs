import type { RemovalPolicy } from 'aws-cdk-lib';
import { STAGING, type Stage } from '../../config/stages';
export interface RemovalPolicyProps {
    readonly developmentRemovalPolicy: RemovalPolicy;
    readonly productionRemovalPolicy: RemovalPolicy;
    readonly stage: Stage;
}

export const getRemovalPolicy = (props: RemovalPolicyProps): RemovalPolicy => {
    return props.stage === STAGING ? props.developmentRemovalPolicy : props.productionRemovalPolicy;
};
