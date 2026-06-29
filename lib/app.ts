import { App } from 'aws-cdk-lib';
import { applyComplianceChecks } from './compliance/aspect';
import { getStage, getUser, isLocalDeploy } from './config/global';
import { PROD, STAGING } from './config/stages';
import { deployPersonal, deployProduction, deployStaging } from './deployments/pipeline';

const app = new App();

// SOC 2 compliance gate: cdk-nag AwsSolutions checks run at synth time and fail
// the build on any unsuppressed finding.
applyComplianceChecks(app);

if (isLocalDeploy()) {
    deployPersonal(app, getUser());
} else {
    const stage = getStage();
    if (stage === STAGING) {
        deployStaging(app);
    } else if (stage === PROD) {
        deployProduction(app);
    } else {
        deployPersonal(app, getUser());
    }
}

export { app };
