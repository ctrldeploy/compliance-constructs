# Security Policy

This project ships infrastructure-as-code that other teams rely on for SOC 2-aligned controls, so we take security reports seriously.

## Supported versions

The latest published `0.x` release is supported. Until `1.0.0`, minor versions may include breaking changes; please track the latest release.

| Version | Supported |
| --- | --- |
| latest `0.x` | ✅ |
| older | ❌ |

## Reporting a vulnerability

**Do not open a public issue for security vulnerabilities.**

Preferred: use GitHub's [private vulnerability reporting](https://github.com/ctrldeploy/compliance-constructs/security/advisories/new) ("Report a vulnerability" on the Security tab).

Alternatively, email **sanjay.shukla398@gmail.com** with:

- A description of the issue and its impact
- Steps to reproduce (a minimal CDK snippet or synthesized template is ideal)
- Affected version(s)

You can expect an acknowledgement within **3 business days** and a status update within **10 business days**. Coordinated disclosure is appreciated — we'll agree on a timeline before any public detail is shared, and credit you in the release notes unless you prefer otherwise.

## Scope

In scope: a `Compliant*` construct that fails to enforce its documented safeguard, an unjustified or overly broad cdk-nag suppression, or a synthesized template that violates a SOC 2 control the construct claims to provide.

Out of scope: vulnerabilities in `aws-cdk-lib`, `cdk-nag`, or other dependencies (report those upstream); misconfigurations introduced by a consumer overriding a safe default.
