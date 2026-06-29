import type { Construct } from 'constructs';
import { suppressCdkManagedResources } from '../compliance/suppressions';
import { CompliantBucket } from '../constructs/bucket.construct';
import { CompliantTable } from '../constructs/dynamodb.construct';
import { CompliantKey } from '../constructs/key.construct';
import { CompliantLogBucket } from '../constructs/log-bucket.construct';
import { UnambiguousStack, type UnambiguousStackProps } from './common/unambiguous.stack';

/**
 * Example storage stack — deploys a {@link CompliantKey}, a
 * {@link CompliantLogBucket} access-log sink, a {@link CompliantBucket} that logs
 * to it, and a {@link CompliantTable} (PITR + CMK encryption).
 */
export class StorageStack extends UnambiguousStack {
    public readonly key: CompliantKey;
    public readonly logBucket: CompliantLogBucket;
    public readonly dataBucket: CompliantBucket;
    public readonly table: CompliantTable;

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

        this.key = new CompliantKey(this, 'data-key', { ...base, alias: 'compliant-data' });

        this.logBucket = new CompliantLogBucket(this, 'access-logs', base);

        this.dataBucket = new CompliantBucket(this, 'data-bucket', {
            ...base,
            encryptionKey: this.key,
            serverAccessLogsBucket: this.logBucket.bucket,
            serverAccessLogsPrefix: 'data-bucket/',
        });

        this.table = new CompliantTable(this, 'data-table', {
            ...base,
            tableName: 'compliant-data',
            encryptionKey: this.key,
        });

        suppressCdkManagedResources(this);
    }
}
