# Mapping CodeSpar mandates to the AP2 authorization UCP uses

**Status:** v0 mapping, draft. Written against UCP release `2026-08-25` and AP2 v0.2. Corrections welcome as issues.

The [Universal Commerce Protocol (UCP)](https://ucp.dev/) covers the whole purchase, from catalog and cart through checkout, order and identity linking. A business advertises each part as a capability in its profile at `/.well-known/ucp`. Payment authorization is not part of the core checkout. UCP delegates it to the [Agent Payments Protocol (AP2)](https://ap2-protocol.org/) through the **AP2 Mandates extension**. This document maps CodeSpar mandates and receipts onto that extension, so a UCP checkout can be paid by push (Pix) under a mandate without a new credential format.

It is the UCP counterpart of [`../ap2/kya-to-ap2-mapping.md`](../ap2/kya-to-ap2-mapping.md). That file maps our mandate to AP2 in general. This one maps it to the parts of AP2 that UCP checkout actually carries on the wire.

## What UCP specifies (as of `2026-08-25`)

| UCP piece | Identifier | What it does |
|---|---|---|
| Catalog | `dev.ucp.shopping.catalog.search`, `dev.ucp.shopping.catalog.lookup` | Product search and lookup. |
| Cart | `dev.ucp.shopping.cart` | Pre-purchase basket: estimated totals, no payment, no completion. A checkout is created from it by `cart_id`. |
| Checkout | `dev.ucp.shopping.checkout` | Create, get, update, complete, cancel. Statuses: `incomplete`, `requires_escalation`, `ready_for_complete`, `complete_in_progress`, `completed`, `canceled`. |
| Order | `dev.ucp.shopping.order` | The order after completion. |
| Identity Linking | `dev.ucp.common.identity_linking` | OAuth 2.0 authorization for the platform to act for the user at the business. |
| Payment handlers | `payment_handlers` in the business profile | How the business accepts instruments. A handler is specified as participants, prerequisites, declaration, instrument acquisition and processing. |
| AP2 Mandates extension | `dev.ucp.common.payment.ap2_mandate` (extends `dev.ucp.shopping.checkout`) | Cryptographic proof of what the business offered and what the user authorized. |

UCP runs over REST, MCP, A2A and an embedded checkout. Google's *Universal Cart* is a consumer product built on UCP, not a separate protocol.

### The AP2 Mandates extension in one paragraph

Once both sides negotiate the extension, the session is **security locked**, and neither side may fall back to an unprotected checkout. The business signs every checkout response in `ap2.merchant_authorization`, a JWS with detached content over the JCS (RFC 8785) canonical checkout, excluding the `ap2` field. On `complete_checkout` the platform sends `ap2.checkout_mandate`, an SD-JWT with key binding that embeds that signed checkout. It also sends a payment mandate in `payment.instruments[*].credential.token`. The business refuses a completion without the mandate (`mandate_required`). It verifies the mandate, its own signature inside it and that the embedded terms match the session. The PSP verifies the payment mandate. Without the extension, the user has to finish checkout in a trusted UI.

### AP2 v0.2 in one paragraph

AP2 v0.2 has two mandates, a **Checkout Mandate**, which secures what is bought, and a **Payment Mandate**, which authorizes paying for it. Each comes in an **open** form and a **closed** form. The open form holds the constraints a user approved, for the human-not-present case. The closed form describes one concrete checkout and payment. Both are SD-JWT credentials. The Payment Mandate is bound to its checkout by the hash of the checkout JWT. AP2 is payment-method agnostic: a new instrument is a new `type`, and the spec describes a flow in which funds are pushed to the merchant and the merchant confirms receipt.

## Concept mapping

| UCP / AP2 | CodeSpar | Notes |
|---|---|---|
| Open Checkout Mandate (constraints the user approved) | Mandate scope: `purposes`, `type`, cap (`amount` / `max_amount`), `expires_at`, and on consumer mandates a payee allowlist bound at consent | Our mandate is already the "open" form: a capped, purpose-scoped, expiring authorization granted once. |
| Open Payment Mandate | The same mandate, presented to the payment side | We do not split checkout and payment authority today. One mandate bounds both, which is the open question below. |
| Closed Checkout Mandate (`ap2.checkout_mandate`) | The quote bound into the agentic receipt: seller, resource, price, payee, session | Ours is produced at settlement and signed by the issuer. AP2's is produced before completion and key-bound to the user or agent. |
| Closed Payment Mandate (`credential.token`) | The spend under the mandate: amount, payee, attempt id | The attempt id makes a retry read the same outcome instead of paying twice. |
| `ap2.merchant_authorization` | Not produced by CodeSpar today | For a merchant whose checkout CodeSpar hosts, CodeSpar would sign as the business. |
| Business verifies mandate, then terms match the session | The settlement guard compares the quoted price and payee with what actually settled and records any divergence in the receipt | Ours runs at settlement. |
| PSP verifies the payment mandate | CodeSpar as the PSP for a Pix handler | This is the role we propose to fill. |
| Agent identity / key binding | `did:web` agent document and Ed25519 keys; `agent_kid` in the mandate | SD-JWT key binding needs a holder key; ours is the agent key. |
| Accountable user | `principal_kyc_ref` | The party the agent acts for. |
| Evidence of execution | Signed receipt (mandate, quote, payment, delivery) | Publicly verifiable; see [`../kya/`](../kya). |

## A Pix payment handler for UCP (sketch)

Written in the shape UCP's payment handler guide asks for. Not yet a handler specification.

- **Participants.** The business (the merchant), the platform (the buyer's agent), and CodeSpar as the PSP that holds the mandate and settles the Pix.
- **Prerequisites.** The business has a Pix receiving identity with the PSP. The buyer has granted a mandate whose allowlist names that business's Pix key, or a wildcard bounded by caps and expiry.
- **Handler declaration.** One entry in the business's `payment_handlers`, with an instrument type for Pix under mandate. Its config names the PSP and the receiving identity. No raw credential is ever advertised.
- **Instrument acquisition.** The platform does not collect a card or a bank credential. The instrument's credential is a reference to the mandate. With the AP2 extension negotiated, the reference sits in `credential.token` as the payment mandate.
- **Processing.** On `complete_checkout` the business verifies the checkout mandate as UCP requires and passes the payment mandate to the PSP. The PSP checks the mandate's signatures, caps, payee and expiry. It then pushes the Pix and confirms asynchronously; the checkout stays in `complete_in_progress` until it does. The order then carries the receipt reference.

The same shape covers other push rails, such as bank transfers and stablecoins, with a different instrument type. The proposal for ACP ([`../acp/pix-push-rail-sep.md`](../acp/pix-push-rail-sep.md)) uses the same mandate primitive.

## Open items

- **One mandate or two.** AP2 separates checkout authority from payment authority; ours binds both in one token. Decide whether we issue both AP2 mandates from one CodeSpar mandate or present ours as the payment mandate only.
- **Envelope.** AP2 v0.2 and the UCP extension use SD-JWT with key binding. Our mandate is a base64url JSON token with Ed25519 agent and issuer signatures. Decide between wrapping it as an SD-JWT that references it and issuing a native SD-JWT.
- **Signature algorithm.** The UCP extension asks for ES256, ES384 or ES512 per AP2 v0.2, and notes an open AP2 discussion on whether only ECDSA is allowed. Our mandate keys are Ed25519, so presenting them directly depends on how that discussion ends.
- **Canonicalization.** UCP signs the JCS canonical checkout. Our receipt chain already uses JCS, but our mandate's signing string is a fixed field order (see [`../kya/mandate-format-v3.md`](../kya/mandate-format-v3.md)). Map one onto the other without changing either.
- **Asynchronous confirmation.** Pix settles by push and is confirmed after the request returns. Confirm that `complete_in_progress` is the intended state for that window, or propose a handler-level status.
- **Revocation and expiry.** Map revocation of a CodeSpar mandate onto what AP2 expects of an open mandate that is withdrawn before use.

## Sources (read 2026-11-17)

- [UCP](https://ucp.dev/) and its [repository](https://github.com/Universal-Commerce-Protocol/ucp), release `v2026-08-25`
- [UCP checkout](https://ucp.dev/latest/specification/shopping/checkout/)
- [UCP cart](https://ucp.dev/latest/specification/shopping/cart/)
- [UCP identity linking](https://ucp.dev/latest/specification/common/identity-linking/)
- [UCP AP2 Mandates extension](https://ucp.dev/latest/specification/payment/extensions/ap2-mandates/)
- UCP payment handler guide, `docs/specification/payment/guide.md` in the UCP repository
- [AP2 v0.2 specification](https://ap2-protocol.org/ap2/specification/) and its [repository](https://github.com/google-agentic-commerce/AP2), release `v0.2.0`
- [Google, Universal Cart](https://blog.google/products-and-platforms/products/shopping/google-shopping-cart/) (2026-05-19)
