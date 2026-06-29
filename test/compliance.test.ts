import { App, Stack } from 'aws-cdk-lib';
import { Annotations, Match } from 'aws-cdk-lib/assertions';
import { applyComplianceChecks } from '../lib/compliance/aspect';
import { DEV } from '../lib/config/stages';
import { ExampleStage } from '../lib/deployments/pipeline';

/**
 * The compliance gate: synthesize the full example stage with the cdk-nag
 * AwsSolutions aspect attached and assert that no stack has any unsuppressed
 * error or warning. Any new resource that violates a SOC 2 safeguard — or any
 * suppression that loses its justification — fails this test (and the build).
 */
describe('cdk-nag AwsSolutions compliance gate', () => {
    const app = new App();
    applyComplianceChecks(app);

    const stage = new ExampleStage(app, 'test', {
        env: { account: '111111111111', region: 'us-east-1' },
        deploymentConfig: {
            account: '111111111111',
            region: 'us-east-1',
            stage: DEV,
            isProd: false,
        },
    });

    const stacks = stage.node.children.filter((c): c is Stack => Stack.isStack(c));

    test('the example stage produces at least one stack', () => {
        expect(stacks.length).toBeGreaterThan(0);
    });

    for (const stack of stacks) {
        describe(stack.stackName, () => {
            const annotations = Annotations.fromStack(stack);

            test('has no unsuppressed AwsSolutions errors', () => {
                const errors = annotations.findError(
                    '*',
                    Match.stringLikeRegexp('AwsSolutions-.*'),
                );
                expect(errors.map((e) => JSON.stringify(e.entry.data))).toEqual([]);
            });

            test('has no unsuppressed AwsSolutions warnings', () => {
                const warnings = annotations.findWarning(
                    '*',
                    Match.stringLikeRegexp('AwsSolutions-.*'),
                );
                expect(warnings.map((w) => JSON.stringify(w.entry.data))).toEqual([]);
            });
        });
    }
});
