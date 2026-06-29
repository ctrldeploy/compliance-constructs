# lib/constructs — agent hints

This is where **all SOC 2 safeguards live**. Stacks compose; constructs enforce. Full reference: [`../../docs/CONSTRUCTS.md`](../../docs/CONSTRUCTS.md).

## Pattern for a compliant construct

Use `bucket.construct.ts` as the reference implementation. Every one follows:

```ts
export interface Compliant<R>Props
    extends Omit<<R>Props, 'encryptionKey'>,  // Omit only when the key type clashes
        DisambiguationProps,
        RemovalPolicyProps {
    readonly encryptionKey?: CompliantKey;     // opt-in CMK; default is AWS-managed SSE
}

export class Compliant<R> extends AlarmableUnambiguousConstruct {  // or UnambiguousConstruct if stateless
    constructor(scope, id, props) {
        super(scope, id, props.disambiguator);
        // resourceName = this.disambiguate(props.name, [props.stage, props.region])
        new <R>(this, '<r>', {
            ...props,                                  // spread first
            // ...then OVERRIDE the safeguarded fields so they always win:
            encryption: props.encryption ?? (props.encryptionKey ? KMS : MANAGED),
            enforceSSL: props.enforceSSL ?? true,
            removalPolicy: getRemovalPolicy(props),    // never hardcode DESTROY/RETAIN
        });
        // this.addAlarm(...) for each CloudWatch alarm
    }
}
```

## Rules

- **Spread `...props` first, override safeguards after.** Order matters — the safeguard must win.
- **Defaults, not mandates.** Allow callers to override (e.g. `props.enforceSSL ?? true`), but default to the secure value.
- **Encryption: AWS-managed by default, CMK via `encryptionKey`.** Don't force customer-managed keys.
- **Removal policy always via `getRemovalPolicy(props)`.**
- **JSDoc must list the safeguards and the cdk-nag rule IDs** each one satisfies (auditors and agents read these).
- **`Unambiguous*` base-class names are public API** — renaming them is a breaking change for consumers.
- **Suppress inline, with a reason,** only when a control is structurally impossible (see `CompliantFunction` X-Ray, `CompliantApi` logging role). Framework custom resources are handled by `suppressCdkManagedResources` at the stack level — don't duplicate.

## After editing

Export from `index.ts`, instantiate in the matching `../stacks/*.stack.ts`, then `npm test` + `npm run synth` and confirm the gate is green.
