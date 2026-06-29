import { Construct } from 'constructs';
import { disambiguate } from './props';

export class UnambiguousConstruct extends Construct {
    public readonly disambiguator: string | undefined;

    constructor(scope: Construct, id: string, disambiguator: string | undefined) {
        super(scope, id);

        this.disambiguator = disambiguator;
    }

    protected disambiguate(
        name?: string,
        additionalDimensions: string[] = [],
        delimiter: string = '-',
    ): string | undefined {
        if (!name) {
            return;
        }

        const disambiguator = [this.disambiguator, ...additionalDimensions]
            .filter((a) => !!a)
            .join(delimiter);
        return disambiguate(name, disambiguator);
    }
}
