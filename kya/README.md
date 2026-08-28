# KYA — Know Your Agent

When an AI agent shows up to spend money, the other side (a merchant, a bank, another agent) needs to answer: **who is this agent, who is accountable for it, how much can it spend, on what, and until when?** KYA is that primitive, done with public cryptography instead of "trust me".

A CodeSpar mandate is a portable, signed credential the agent carries and presents. It is:

- **Dual-signed** (Ed25519) by the agent and by the issuer, over a canonical string.
- **Scoped**: a spend cap, a currency, a set of purposes, an expiry, and a bound accountable principal. All of those are inside the signed string, so none of them can be edited without breaking the signatures, and the expiry is enforced by the verdict rather than merely reported.
- **Checkable without a credential**: the public keys are published, so anyone can check both signatures with `node:crypto`. No SDK, no API key, no authenticated call, and no CodeSpar-specific endpoint. Key resolution follows the `did:web` method, so any conformant resolver reaches the same document. Pin those documents and the whole check runs with no network at all.

## Verify one yourself

```bash
node verify.mjs token.txt
```

Expected output:

```
VERIFIED
agent:       <agent-id>
principal:   <principal reference>
signatures:  agent ok + issuer ok
issuer:      did:web:id.codespar.dev (default, not asserted by the token)
keys:        resolved over did:web
cap:         BRL 500 | purposes: groceries | expires in: 1d
```

To verify with no network at all, pin the DID documents you already hold:

```bash
node verify.mjs token.txt --did-doc agent.did.json --did-doc issuer.did.json
```

The exit code is `0` only when the mandate is valid, so this drops into a script or a CI gate.

## What this verifier does, and what it does not do

[`verify.mjs`](./verify.mjs) is a single dependency-free file (`node:crypto`, `node:fs`). It reproduces the canonical signing string, resolves the two public keys, checks both Ed25519 signatures, and checks that the mandate has not expired.

**It fails closed.** A signature that does not verify, a `kid` the DID document does not list, a key that is present but not an `assertionMethod`, a document whose `id` does not match the DID that was resolved, or an `expires_at` in the past all produce `INVALID`, a `reason:` line, and a non-zero exit. Expiry is checked separately from the signatures precisely because a correctly signed mandate that has run out is still not a mandate.

**Key resolution is derived from the DID, not from a CodeSpar endpoint.** `did:web:h:a:b` resolves to `https://h/a/b/did.json` and a bare `did:web:h` to `https://h/.well-known/did.json`, per the method. Nothing about the URL is specific to us, so a verifier that wants no CodeSpar dependency does not have to trust that we constructed it honestly: it can construct the same URL itself, or use any off-the-shelf `did:web` resolver. The issuer key is served at `https://id.codespar.dev/.well-known/did.json`. The resolution rules are in [`mandate-format-v3.md`](./mandate-format-v3.md#key-resolution-didweb).

That derived `GET` is the only network access, and signature checking is pure local computation. Pass `--did-doc` and even the fetch disappears, which is the mode to use when proving a mandate long after the fact, or when the domain that published the key no longer answers.

**The token does not say who issued it, and that is a limitation of the format.** The V3/V4 canonical string has no `issuer_did` field, so the verifier cannot learn the issuer from the token and has to be told. `--issuer-did` supplies it and defaults to the CodeSpar platform issuer. Until a format version carries `issuer_did` inside the signed bytes, **an issuer named on the command line is an assumption the caller makes, not a fact the signature proves**, and any multi-issuer deployment needs that field added to the canonical string first. The output labels the default so this is visible rather than implied.

## Format

The exact byte layout, field order, and encoding rules are in [`mandate-format-v3.md`](./mandate-format-v3.md). If you change the canonical string, the signatures break, which is the point.

## Notes on honesty

- `principal` prints the bound principal reference the mandate carries. Whether that reference is itself proofed against a KYC provider is a property of the issuing environment, not of the signature. The verifier reports what is bound; it does not assert a KYC level the format cannot prove.
- A signed reputation attestation (score, anchored to an audit chain) is a separate public endpoint; it is out of scope for this verifier.
- `did:web` roots trust in DNS and TLS: whoever controls the domain controls every identity under it, and the document carries no history, so a key that rotates or is revoked takes the mandates it signed with it. Pinning the document with `--did-doc` is the mitigation available today. Removing the underlying limitation needs a method that keeps a verifiable log, which is a change to the format, not to this script.
