import { Alias, type IKey } from 'aws-cdk-lib/aws-kms';
import { Topic, type TopicProps } from 'aws-cdk-lib/aws-sns';
import type { Construct } from 'constructs';
import type { CompliantKey } from './key.construct';
import type { DisambiguationProps, RemovalPolicyProps } from './props';
import { UnambiguousConstruct } from './unambiguous.construct';

export interface CompliantTopicProps
    extends Partial<TopicProps>,
        DisambiguationProps,
        RemovalPolicyProps {
    /** Optional customer-managed key. When supplied, the topic is encrypted with it instead of the AWS-managed SNS key. */
    readonly encryptionKey?: CompliantKey;
}

/**
 * An SNS topic with SOC 2 safeguards baked in.
 *
 * Safeguards:
 *  - Server-side encryption: the AWS-managed `alias/aws/sns` key by default,
 *    or a customer-managed key when an `encryptionKey` is supplied — AwsSolutions-SNS2.
 *  - TLS enforced in transit via `enforceSSL` — AwsSolutions-SNS3.
 */
export class CompliantTopic extends UnambiguousConstruct {
    public readonly topic: Topic;
    public readonly topicName: string | undefined;

    constructor(scope: Construct, id: string, props: CompliantTopicProps) {
        super(scope, id, props.disambiguator);

        this.topicName = this.disambiguate(props.topicName);

        const masterKey: IKey =
            props.encryptionKey?.key ??
            Alias.fromAliasName(this, 'sns-managed-key', 'alias/aws/sns');

        this.topic = new Topic(this, 'topic', {
            ...props,
            topicName: this.topicName,
            masterKey: props.masterKey ?? masterKey,
            enforceSSL: props.enforceSSL ?? true,
        });
    }
}
