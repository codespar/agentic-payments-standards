# CodeSpar Mandate, canonical format V3

A mandate token is a `base64url`-encoded UTF-8 JSON object. It carries the mandate fields plus a signature envelope. V3 adds two Ed25519 signatures (agent + issuer) on top of the fields.

## Fields

| Field | Type | Notes |
|---|---|---|
| `format_version` | number | `3` for this spec. |
| `id` | string | Mandate id. |
| `agent_id` | string | The agent this mandate authorizes. |
| `type` | string | `payment` \| `subscription` \| `delegation`. |
| `amount` | string | Decimal string, no trailing zeros (e.g. `"500"`, `"99.5"`). |
| `currency` | string | ISO 4217 (e.g. `BRL`). |
| `purposes` | string[] | ASCII only. Sorted and escaped in the canonical string. |
| `expires_at` | number | UNIX seconds. |
| `max_amount` | string \| null | Optional. |
| `parent_id` | string \| null | Optional. |
| `denomination` | string \| null | Optional. |
| `secret_version` | number | Issuer key version. |
| `principal_kyc_ref` | string \| null | V3. Reference to the accountable principal. Emitted verbatim. |
| `agent_kid` | string \| null | V3. The agent key id, `<agent_did>#<n>`. Emitted verbatim. |

Signature envelope (alongside the fields, not part of the signed string):

| Field | Notes |
|---|---|
| `signature` | Org HMAC-SHA256 hex digest (present on every version). |
| `agent_sig` | V3. Ed25519 signature by the agent key (base64url). |
| `issuer_sig` | V3. Ed25519 signature by the platform issuer key (base64url). |

## Canonical signing string

14 fields, 13 `:` separators, in this exact order:

```
format_version : id : agent_id : type : amount : currency :
purposes : expires_at : max_amount : parent_id : denomination :
secret_version : principal_kyc_ref : agent_kid
```

Encoding rules:

- Absent optional fields (`max_amount`, `parent_id`, `denomination`, `principal_kyc_ref`, `agent_kid`) render as the empty string. The separator count is invariant.
- `purposes` is comma-joined after a lexicographic sort, with escaping applied to each member: `\` becomes `\\` **first**, then `,` becomes `\,`. Order matters.
- Colons inside a field (e.g. `agent_kid` contains the `did:web:` prefix) are emitted verbatim. The signing string is a one-way serialization computed from parsed JSON and is never re-split into fields, so an embedded colon carries no separator meaning.
- Numeric fields are stringified as-is (no trailing zeros on `amount` / `max_amount`).

## Signatures

- The same canonical string is signed by the agent's Ed25519 key and by the issuer's Ed25519 key. Ed25519 is deterministic (RFC 8032), so a given (string, key) always yields the same signature, which lets a fixture byte-freeze it.
- The org HMAC `signature` covers the same string and is unchanged from V2. Existing HMAC verifiers keep working.

## Key resolution (`did:web`)

- The agent public key is at the agent's `did:web` document. `agent_kid` = `<agent_did>#<n>`; resolve `<agent_did>` and pick the `verificationMethod` whose `id` equals `agent_kid`.
- The issuer public key is at the issuer well-known DID `did:web:id.codespar.dev`, key id `did:web:id.codespar.dev#1`.
- Keys are published as `publicKeyJwk` (Ed25519, `kty: OKP`).

## Reference verifier

[`verify.mjs`](./verify.mjs) reproduces the string above and checks both Ed25519 signatures against the resolved public keys. It is dependency-free (`node:crypto`, `node:fs`).

Two caveats about that script as written. It does not follow the `did:web` resolution described above: it fetches both keys from `https://api.codespar.dev/v1/agents/<did>/did.json`, so it needs that host. And its `VERIFIED` line covers the two signatures only, not `expires_at`. Both are described in [`README.md`](./README.md).
