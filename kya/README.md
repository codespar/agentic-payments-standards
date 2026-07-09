# KYA — Know Your Agent

When an AI agent shows up to spend money, the other side (a merchant, a bank, another agent) needs to answer: **who is this agent, who is accountable for it, how much can it spend, on what, and until when?** KYA is that primitive, done with public cryptography instead of "trust me".

A CodeSpar mandate is a portable, signed credential the agent carries and presents. It is:

- **Dual-signed** (Ed25519) by the agent and by the issuer, over a canonical string.
- **Scoped**: a spend cap, a currency, a set of purposes, an expiry, and a bound accountable principal.
- **Offline-verifiable**: anyone can check it with the public keys published at the agent's `did:web` document. No SDK, no API key, no authenticated call.

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
cap:         BRL 500 | purposes: groceries | expires in: 1d
```

The verifier ([`verify.mjs`](./verify.mjs)) is intentionally ~40 lines of `node:crypto`. It reproduces the canonical signing string, resolves the two public keys from the public `did:web` documents, and checks both signatures. That is the whole trust model: **whoever verifies does not ask permission from whoever issued.**

## Format

The exact byte layout, field order, and encoding rules are in [`mandate-format-v3.md`](./mandate-format-v3.md). If you change the canonical string, the signatures break, which is the point.

## Notes on honesty

- `principal` prints the bound principal reference the mandate carries. Whether that reference is itself proofed against a KYC provider is a property of the issuing environment, not of the signature. The verifier reports what is bound; it does not assert a KYC level the format cannot prove.
- A signed reputation attestation (score, anchored to an audit chain) is a separate public endpoint; it is out of scope for this offline verifier.
