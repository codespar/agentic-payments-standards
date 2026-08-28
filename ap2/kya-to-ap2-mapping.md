# Mapping CodeSpar mandates to AP2

**Status:** v0 mapping, to be validated against the current AP2 spec. Corrections welcome.

[AP2 (Agent Payments Protocol)](https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol), led by Google with a broad set of participants, models agent payments as **mandates expressed as verifiable credentials**, and is deliberately payment-method agnostic (cards, bank transfers, and crypto/stablecoins). CodeSpar's mandate model is a close conceptual sibling: a scoped, signed authorization an agent carries and presents. This document maps the two so the pieces interoperate rather than compete.

## Concept mapping

| AP2 concept | CodeSpar equivalent | Notes |
|---|---|---|
| Intent Mandate (what the user authorizes in the abstract) | Mandate scope: `purposes`, `type`, cap (`amount` / `max_amount`), `expires_at` | Our mandate binds intent as capped, purpose-scoped authorization. |
| Cart Mandate (the specific transaction the user approves) | The spend executed against a mandate + its receipt | Our per-spend receipt is the evidence a specific debit happened within the mandate. |
| Payment Mandate (authorization presented to the payment side) | The dual-signed mandate token (Ed25519 agent + issuer) | Checkable from the published Ed25519 public keys, with no credential; see [`../kya/mandate-format-v3.md`](../kya/mandate-format-v3.md). |
| Agent identity / credentials | `did:web` agent document + published Ed25519 keys | W3C DID, nothing proprietary. |
| Accountable user / principal | `principal_kyc_ref` bound in the mandate | The party the agent acts for. |
| Verifiable evidence of execution | Signed receipt + audit-chain-anchored attestation | Reproducible, public. |

## Where CodeSpar adds to AP2

- **Non-card rails in production.** AP2 is method-agnostic by design; CodeSpar contributes a live Pix (and USDC/x402) implementation of the "push under a mandate" pattern, plus the same mandate primitive proposed for ACP (see [`../acp/pix-push-rail-sep.md`](../acp/pix-push-rail-sep.md)).
- **A dependency-free reference verifier.** The mandate is checkable with a few lines of `node:crypto`, no SDK and no API key. It resolves the signer keys over the network and its verdict does not yet cover expiry, both stated in [`../kya/README.md`](../kya/README.md). That is a useful reference for anyone implementing AP2's "verify the mandate" step.

## Open items

- Align field names and the canonical serialization with AP2's verifiable-credential envelope.
- Decide whether the CodeSpar mandate is presented as an AP2 Payment Mandate directly, or wrapped as a VC that references it.
- Map revocation and expiry semantics across both models.
