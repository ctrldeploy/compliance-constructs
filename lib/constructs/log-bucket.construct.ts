import { NagSuppressions } from 'cdk-nag';
import type { Construct } from 'constructs';
import { CompliantBucket, type CompliantBucketProps } from './bucket.construct';

export type CompliantLogBucketProps = Omit<
    CompliantBucketProps,
    'serverAccessLogsBucket' | 'serverAccessLogsPrefix'
>;

/**
 * A hardened S3 bucket intended to be the destination for other buckets'
 * server access logs.
 *
 * It carries all {@link CompliantBucket} safeguards. Because a log bucket
 * cannot log to itself, AwsSolutions-S1 is suppressed here with an explicit,
 * audit-ready justification — this is the one place that suppression is valid.
 */
export class CompliantLogBucket extends CompliantBucket {
    constructor(scope: Construct, name: string, props: CompliantLogBucketProps) {
        super(scope, name, props);

        NagSuppressions.addResourceSuppressions(this.bucket, [
            {
                id: 'AwsSolutions-S1',
                reason: 'This is the centralized server-access-log destination bucket; an access-log target cannot write its own access logs to itself. SOC 2 logging is satisfied by this bucket being the audit log sink.',
            },
        ]);
    }
}
