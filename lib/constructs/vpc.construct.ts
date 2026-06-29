import {
    FlowLogDestination,
    FlowLogTrafficType,
    IpAddresses,
    SubnetType,
    Vpc,
    type VpcProps,
} from 'aws-cdk-lib/aws-ec2';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import type { Construct } from 'constructs';
import { type DisambiguationProps, getRemovalPolicy, type RemovalPolicyProps } from './props';
import { UnambiguousConstruct } from './unambiguous.construct';

export interface CompliantVpcProps
    extends Partial<VpcProps>,
        DisambiguationProps,
        RemovalPolicyProps {
    /** CIDR for the VPC. @default '10.0.0.0/16' */
    readonly cidr?: string;
    /** Flow-log retention. @default RetentionDays.ONE_YEAR */
    readonly flowLogRetention?: RetentionDays;
}

/**
 * A VPC with SOC 2 safeguards baked in.
 *
 * Safeguards:
 *  - VPC flow logs (ALL traffic) to a retention-bound CloudWatch log group — AwsSolutions-VPC7.
 *  - The default security group is restricted to deny all traffic via the
 *    `@aws-cdk/aws-ec2:restrictDefaultSecurityGroup` feature flag (set in cdk.json).
 *  - Private, egress-only application subnets by default.
 */
export class CompliantVpc extends UnambiguousConstruct {
    public readonly vpc: Vpc;
    public readonly flowLogGroup: LogGroup;

    constructor(scope: Construct, id: string, props: CompliantVpcProps) {
        super(scope, id, props.disambiguator);

        this.flowLogGroup = new LogGroup(this, 'flow-log-group', {
            retention: props.flowLogRetention ?? RetentionDays.ONE_YEAR,
            removalPolicy: getRemovalPolicy(props),
        });

        this.vpc = new Vpc(this, 'vpc', {
            ipAddresses: IpAddresses.cidr(props.cidr ?? '10.0.0.0/16'),
            maxAzs: 2,
            natGateways: 1,
            subnetConfiguration: [
                { name: 'public', subnetType: SubnetType.PUBLIC, cidrMask: 24 },
                { name: 'private', subnetType: SubnetType.PRIVATE_WITH_EGRESS, cidrMask: 24 },
            ],
            ...props,
            flowLogs: props.flowLogs ?? {
                'cloudwatch-flow-log': {
                    destination: FlowLogDestination.toCloudWatchLogs(this.flowLogGroup),
                    trafficType: FlowLogTrafficType.ALL,
                },
            },
        });
    }
}
