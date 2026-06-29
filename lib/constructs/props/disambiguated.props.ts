import type { Stage } from '../../config/stages';

export interface DisambiguationProps {
    readonly disambiguator: string;
    readonly stage: Stage;
    readonly region: string;
    readonly account: string;
}

/**
 * Disambiguates a name by appending a disambiguator to it
 * @param name - The name to disambiguate
 * @param disambiguator - The disambiguator to append to the name
 * @param delimiter - The delimiter to use between the disambiguator and the name
 * @returns The disambiguated name
 */
export const disambiguate = (
    name: string | undefined,
    disambiguator?: string,
    delimiter = '-',
): string | undefined => {
    if (name) {
        return disambiguator ? [disambiguator, name].join(delimiter) : name;
    }
    return name;
};
