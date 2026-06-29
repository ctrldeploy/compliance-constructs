import type { Construct } from 'constructs';
import { suppressCdkManagedResources } from '../compliance/suppressions';
import { CompliantQueue } from '../constructs/event-queue.construct';
import { CompliantKey } from '../constructs/key.construct';
import { CompliantTopic } from '../constructs/topic.construct';
import { UnambiguousStack, type UnambiguousStackProps } from './common/unambiguous.stack';

/**
 * Example messaging stack — deploys a {@link CompliantTopic} and a
 * {@link CompliantQueue} (which provisions its own {@link CompliantDLQ}), all
 * encrypted with a shared {@link CompliantKey} and SSL-enforced.
 */
export class MessagingStack extends UnambiguousStack {
    public readonly key: CompliantKey;
    public readonly topic: CompliantTopic;
    public readonly queue: CompliantQueue;

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

        this.key = new CompliantKey(this, 'messaging-key', {
            ...base,
            alias: 'compliant-messaging',
        });

        this.topic = new CompliantTopic(this, 'events-topic', {
            ...base,
            topicName: 'compliant-events',
            encryptionKey: this.key,
        });

        this.queue = new CompliantQueue(this, 'events-queue', {
            ...base,
            queueName: 'compliant-events',
            encryptionKey: this.key,
        });

        suppressCdkManagedResources(this);
    }
}
