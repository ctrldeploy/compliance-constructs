import {
    AccessLogFormat,
    AuthorizationType,
    type IRestApi,
    LogGroupLogDestination,
    MethodLoggingLevel,
    MockIntegration,
    PassthroughBehavior,
    RestApi,
    type RestApiProps,
} from 'aws-cdk-lib/aws-apigateway';
import { LogGroup, RetentionDays } from 'aws-cdk-lib/aws-logs';
import { CfnWebACL, CfnWebACLAssociation } from 'aws-cdk-lib/aws-wafv2';
import { NagSuppressions } from 'cdk-nag';
import type { Construct } from 'constructs';
import { type DisambiguationProps, getRemovalPolicy, type RemovalPolicyProps } from './props';
import { UnambiguousConstruct } from './unambiguous.construct';

export interface CompliantApiProps
    extends Partial<RestApiProps>,
        DisambiguationProps,
        RemovalPolicyProps {
    /** Access-log retention. @default RetentionDays.ONE_YEAR */
    readonly accessLogRetention?: RetentionDays;
    /** Whether to attach a WAF WebACL to the stage. @default true */
    readonly enableWaf?: boolean;
}

/**
 * A REST API Gateway with SOC 2 safeguards baked in.
 *
 * Safeguards:
 *  - Access logging to a retention-bound CloudWatch log group — AwsSolutions-APIG1.
 *  - Request validation enabled by default — AwsSolutions-APIG2.
 *  - A regional WAF WebACL associated to the stage — AwsSolutions-APIG3.
 *  - IAM authorization required on methods — AwsSolutions-APIG4 / Cognito-not-required.
 *  - Execution logging at INFO with metrics — AwsSolutions-APIG6.
 */
export class CompliantApi extends UnambiguousConstruct {
    public readonly api: RestApi;
    public readonly accessLogGroup: LogGroup;
    public readonly webAcl?: CfnWebACL;

    constructor(scope: Construct, id: string, props: CompliantApiProps) {
        super(scope, id, props.disambiguator);

        this.accessLogGroup = new LogGroup(this, 'access-logs', {
            retention: props.accessLogRetention ?? RetentionDays.ONE_YEAR,
            removalPolicy: getRemovalPolicy(props),
        });

        this.api = new RestApi(this, 'api', {
            restApiName: this.disambiguate(props.restApiName ?? id),
            cloudWatchRole: true,
            deployOptions: {
                accessLogDestination: new LogGroupLogDestination(this.accessLogGroup),
                accessLogFormat: AccessLogFormat.jsonWithStandardFields(),
                loggingLevel: MethodLoggingLevel.INFO,
                metricsEnabled: true,
                ...props.deployOptions,
            },
            defaultMethodOptions: {
                authorizationType: AuthorizationType.IAM,
                ...props.defaultMethodOptions,
            },
            ...props,
        });

        // Request validation (APIG2) applied as the API's default validator.
        const validator = this.api.addRequestValidator('default-validator', {
            validateRequestBody: true,
            validateRequestParameters: true,
        });

        // A minimal IAM-authorized, validated method so the API has a deployable surface.
        this.api.root.addMethod(
            'GET',
            new MockIntegration({
                integrationResponses: [{ statusCode: '200' }],
                passthroughBehavior: PassthroughBehavior.NEVER,
                requestTemplates: { 'application/json': '{ "statusCode": 200 }' },
            }),
            {
                methodResponses: [{ statusCode: '200' }],
                authorizationType: AuthorizationType.IAM,
                requestValidator: validator,
            },
        );

        if (props.enableWaf ?? true) {
            this.webAcl = new CfnWebACL(this, 'web-acl', {
                defaultAction: { allow: {} },
                scope: 'REGIONAL',
                visibilityConfig: {
                    cloudWatchMetricsEnabled: true,
                    metricName: this.disambiguate('compliant-api-waf') ?? 'compliant-api-waf',
                    sampledRequestsEnabled: true,
                },
                rules: [
                    {
                        name: 'AWSManagedRulesCommonRuleSet',
                        priority: 0,
                        overrideAction: { none: {} },
                        statement: {
                            managedRuleGroupStatement: {
                                vendorName: 'AWS',
                                name: 'AWSManagedRulesCommonRuleSet',
                            },
                        },
                        visibilityConfig: {
                            cloudWatchMetricsEnabled: true,
                            metricName: 'AWSManagedRulesCommonRuleSet',
                            sampledRequestsEnabled: true,
                        },
                    },
                ],
            });

            new CfnWebACLAssociation(this, 'web-acl-association', {
                resourceArn: this.api.deploymentStage.stageArn,
                webAclArn: this.webAcl.attrArn,
            });
        }

        // API Gateway must assume an account-level role with the AWS-managed
        // push-to-CloudWatch-Logs policy in order to emit execution logs (APIG6).
        NagSuppressions.addResourceSuppressions(
            this.api,
            [
                {
                    id: 'AwsSolutions-IAM4',
                    reason: 'API Gateway requires the AWS-managed AmazonAPIGatewayPushToCloudWatchLogs policy on its account-level role to deliver execution/access logs; this is the AWS-prescribed mechanism for the logging control itself.',
                },
            ],
            true,
        );
    }

    public get restApi(): IRestApi {
        return this.api;
    }
}
