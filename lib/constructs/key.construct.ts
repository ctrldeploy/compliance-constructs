import { Key, type KeyProps } from 'aws-cdk-lib/aws-kms';
import type { Construct } from 'constructs';
import { type DisambiguationProps, getRemovalPolicy, type RemovalPolicyProps } from './props';
import { UnambiguousConstruct } from './unambiguous.construct';

export interface CompliantKeyProps
    extends Partial<KeyProps>,
        DisambiguationProps,
        RemovalPolicyProps {}

/**
 * A KMS customer-managed key with SOC 2 safeguards baked in.
 *
 * Safeguards:
 *  - Automatic annual key rotation (cdk-nag AwsSolutions-KMS5).
 *  - Removal policy driven by stage (RETAIN in production).
 *
 * Use this as the optional `encryptionKey` for {@link CompliantBucket},
 * {@link CompliantTable}, {@link CompliantQueue}, and {@link CompliantTopic}
 * to upgrade from AWS-managed encryption to a customer-managed CMK.
 */
export class CompliantKey extends UnambiguousConstruct {
    public readonly key: Key;
    public readonly alias: string | undefined;

    constructor(scope: Construct, id: string, props: CompliantKeyProps) {
        super(scope, id, props.disambiguator);

        this.alias = this.disambiguate(props.alias ?? id, [props.stage, props.region]);

        this.key = new Key(this, 'key', {
            ...props,
            alias: this.alias,
            enableKeyRotation: true,
            removalPolicy: getRemovalPolicy(props),
        });
    }
}
