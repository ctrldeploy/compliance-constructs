# Contributing to compliance-constructs

Thanks for your interest! This project is a SOC 2-focused AWS CDK construct library, and its credibility rests on one thing: **the cdk-nag compliance gate is always green.** Everything below serves that.

## Ground rules

- Be respectful — see the [Code of Conduct](CODE_OF_CONDUCT.md).
- Report security issues privately — see [SECURITY.md](SECURITY.md), not the public issue tracker.
- No secrets, account IDs, or business-specific values in code, tests, or docs.

## Getting started

```bash
git clone https://github.com/ctrldeploy/compliance-constructs
cd compliance-constructs
npm install
npm run check   # typecheck + biome
npm test        # cdk-nag compliance gate + snapshots
npm run synth   # synth the example app under the gate
```

For deeper context, read [`CLAUDE.md`](CLAUDE.md) and [`docs/`](docs/README.md) (architecture, per-construct reference, and the compliance model).

## Making a change

1. **Branch** off `main`.
2. **Keep safeguards in constructs, not stacks.** New AWS resources must ship as a `Compliant*` construct with the safeguard baked into its defaults. Use `lib/constructs/bucket.construct.ts` as the quality bar.
3. **Keep the gate green.** Run `npm test` and `npm run synth`. If cdk-nag flags a resource, **fix the resource** — only suppress when the consumer genuinely cannot harden it, and write a substantive `reason` (see [`docs/COMPLIANCE.md`](docs/COMPLIANCE.md)).
4. **Update docs** — the construct's JSDoc (safeguards + cdk-nag rule IDs), `docs/CONSTRUCTS.md`, and the README tables.
5. **Snapshots:** intentional infra changes will fail the snapshot test; review the diff, then `npx jest -u` to re-baseline. Never `-u` away a *compliance* test failure — that means a real control regressed.

## Commit messages — Conventional Commits

Releases are automated by [release-please](https://github.com/googleapis/release-please) from commit messages, so format matters:

- `feat: ...` → minor release · `fix: ...` → patch release · `feat!:` / `BREAKING CHANGE:` → major
- `docs:`, `test:`, `chore:`, `ci:`, `refactor:` → no release

Example: `feat(bucket): add object-lock retention option`

## Pull requests

- Keep PRs focused; fill in the PR template.
- CI must pass (typecheck, biome, build, tests, synth).
- A maintainer reviews; squash-merge with a Conventional Commit title.

## Definition of done

✅ `npm run check` clean · ✅ `npm test` green (gate + snapshots) · ✅ `npm run synth` exits 0 · ✅ docs updated · ✅ no secrets introduced.
