import { type Duration, RemovalPolicy } from 'aws-cdk-lib';
import {
    Alarm,
    type AlarmProps,
    type CfnAlarm,
    TreatMissingData,
} from 'aws-cdk-lib/aws-cloudwatch';
import type { Construct } from 'constructs';
import type { DisambiguationProps, RemovalPolicyProps } from './props';
import { UnambiguousConstruct } from './unambiguous.construct';

export interface BasicAlarmConfig {
    threshold: number;
    evaluationPeriods: number;
    period?: Duration;
    severity: number;
}

export interface BasicAlarmProps extends AlarmProps, DisambiguationProps, RemovalPolicyProps {
    isCritical?: boolean;
}

export class BasicAlarm extends UnambiguousConstruct {
    public readonly alarm: Alarm;
    public readonly isCritical: boolean;

    private readonly props: BasicAlarmProps;

    constructor(scope: Construct, id: string, props: BasicAlarmProps) {
        super(scope, id, props.disambiguator);

        this.props = props;
        this.isCritical = props.isCritical || false;

        this.alarm = new Alarm(this, 'alarm', {
            ...props,
            metric: this.props.metric,
            threshold: this.props.threshold,
            evaluationPeriods: this.props.evaluationPeriods,
            alarmName: this.props.alarmName,
            alarmDescription: 'This is an auto-cut alarm created by CDK.',
            treatMissingData: this.props.treatMissingData || TreatMissingData.NOT_BREACHING,
            actionsEnabled: this.props.actionsEnabled,
            comparisonOperator: this.props.comparisonOperator,
            datapointsToAlarm: this.props.datapointsToAlarm,
        });

        const cfnAlarm = this.alarm.node.defaultChild as CfnAlarm;
        cfnAlarm.applyRemovalPolicy(RemovalPolicy.DESTROY);
    }
}
