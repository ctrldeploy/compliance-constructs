import { RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import {
    type DisambiguationProps,
    disambiguate,
    type RemovalPolicyProps,
} from '../../constructs/props';

export interface UnambiguousStackProps
    extends StackProps,
        DisambiguationProps,
        RemovalPolicyProps {}

export class UnambiguousStack extends Stack {
    /**
     * String to disambiguate the stack from other stacks in the same account and region
     */
    public readonly disambiguator: string;

    constructor(scope: Construct, id: string, props: UnambiguousStackProps) {
        super(scope, id, {
            ...props,
            terminationProtection: props.productionRemovalPolicy === RemovalPolicy.RETAIN,
            stackName: disambiguate(props.stackName, props.disambiguator),
            crossRegionReferences: true, // Enable cross-region references for WAF (us-east-1) <-> other stacks
        });
        this.disambiguator = props.disambiguator;
    }
}
