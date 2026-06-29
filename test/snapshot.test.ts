import { App, Stack } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { DEV } from '../lib/config/stages';
import { ExampleStage } from '../lib/deployments/pipeline';

/**
 * Snapshot the synthesized templates so unintended infrastructure drift in the
 * compliant constructs is caught in review. Re-run with `jest -u` to update the
 * baseline after an intentional change.
 */
describe('example stage CloudFormation snapshots', () => {
    const app = new App();
    const stage = new ExampleStage(app, 'snapshot', {
        env: { account: '111111111111', region: 'us-east-1' },
        deploymentConfig: {
            account: '111111111111',
            region: 'us-east-1',
            stage: DEV,
            isProd: false,
        },
    });

    const stacks = stage.node.children.filter((c): c is Stack => Stack.isStack(c));

    for (const stack of stacks) {
        test(`${stack.stackName} matches snapshot`, () => {
            expect(Template.fromStack(stack).toJSON()).toMatchSnapshot();
        });
    }
});
