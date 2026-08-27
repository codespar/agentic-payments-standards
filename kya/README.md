# KYA — Know Your Agent

When an AI agent shows up to spend money, the other side (a merchant, a bank, another agent) needs to answer: **who is this agent, who is accountable for it, how much can it spend, on what, and until when?** KYA is that primitive, done with public cryptography instead of "trust me".

A CodeSpar mandate is a portable, signed credential the agent carries and presents. It is:

- **Dual-signed** (Ed25519) by the agent and by the issuer, over a canonical string.
- **Scoped**: a spend cap, a currency, a set of purposes, an expiry, and a bound accountable principal. All of those are inside the signed string, so none of them can be edited without breaking the signatures. Enforcing the expiry is a separate act, and the script in this folder does not do it yet: see below.
- **Checkable without a credential**: the public keys are published, so anyone can check both signatures with `node:crypto`. No SDK, no API key, no authenticated call. What the script in this folder does still need is network access to a CodeSpar host to fetch those keys: see below.

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

## What this verifier does, and what it does not do

[`verify.mjs`](./verify.mjs) is a single dependency-free file (`node:crypto`, `node:fs`). It reproduces the canonical signing string and checks both Ed25519 signatures. Two properties of it are easy to assume and wrong, so they are stated here.

**It needs the network, and the call goes to a CodeSpar host.** Key resolution is an unauthenticated `GET https://api.codespar.dev/v1/agents/<did>/did.json`, and both keys are fetched that way, the agent's and the issuer's (the `pubkey` function in [`verify.mjs`](./verify.mjs)). So this script is not an offline verifier. With that host unreachable or answering with anything other than a DID document, it throws while resolving keys and prints no verdict at all. No credential is attached to the call and the token is not uploaded, but the DID in the URL does tell that host which agent you are checking, and both availability and key integrity rest on infrastructure CodeSpar operates.

The format does not require that shortcut. The keys are published as ordinary `did:web` documents, so a verifier that does not want a CodeSpar dependency can resolve them per the DID spec instead: the issuer key is served at `https://id.codespar.dev/.well-known/did.json`. Making the script resolve keys that way is a change to the script, not to this page. The resolution rules are in [`mandate-format-v3.md`](./mandate-format-v3.md#key-resolution-didweb).

**The verdict does not check expiry.** The `VERIFIED` / `INVALID` line reports signatures and nothing else: it is `agentOk && issuerOk`. An expired mandate with intact signatures still prints `VERIFIED`, and the expiry shows up only as a negative number further down the output (`expires in: -300d`). Anything relying on this script has to compare `expires_at` against its own clock. That is a defect in the script; this page describes what it does today, and changing the verdict is a code change that is not part of this document.

## Format

The exact byte layout, field order, and encoding rules are in [`mandate-format-v3.md`](./mandate-format-v3.md). If you change the canonical string, the signatures break, which is the point.

## Notes on honesty

- `principal` prints the bound principal reference the mandate carries. Whether that reference is itself proofed against a KYC provider is a property of the issuing environment, not of the signature. The verifier reports what is bound; it does not assert a KYC level the format cannot prove.
- A signed reputation attestation (score, anchored to an audit chain) is a separate public endpoint; it is out of scope for this verifier.
