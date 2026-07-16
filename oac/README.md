# Open Agentic Commerce (OAC) — the spec we extend, and references

This folder holds CodeSpar's **additive** contributions to the **Open Agentic Commerce API**, the merchant-controlled interface defined in Basis Theory's v0.1.0 whitepaper *Empowering Merchant-Controlled AI Commerce* and stewarded by the **Agentic Commerce Consortium (ACC)**.

We are a **member** of the ACC contributing proposals. We are **not** a co-author of the v0.1.0 spec. No OAC text is reproduced in this repo; read the source at the links below.

## Canonical sources

- **Consortium:** https://basistheory.ai/consortium — the ACC, the whitepaper, and how to join.
- **Whitepaper:** *Empowering Merchant-Controlled AI Commerce: An Open Agentic Commerce Whitepaper* (BT/AI, v0.1.0), on the consortium page.
- **Living spec + discussion:** the ACC Slack channel and the monthly town hall (3rd Tuesday) — members.

## The v0.1.0 surface we extend

A short restatement, in our words, of the parts of OAC v0.1.0 our proposals touch, using the spec's own section names so the delta is exact. Read the whitepaper for the authoritative text.

- **Manifest** — a `.well-known` commerce manifest, the single source of truth for a merchant's endpoints, schemas, payments, and auth.
- **Product Discovery** — a Schema.org-aligned catalog: a Product Listing Endpoint plus Pricing and Offers.
- **Orders** — a two-step create/confirm flow that computes **deterministic totals** (items, tax, shipping, discounts) and establishes order state.
- **Payment Processing** — a unified **`pay`** endpoint that routes to the merchant's rails, plus **Payment Methods** (`acceptedPaymentMethod[]`: card, crypto, wallets, bank) and a **Return Endpoint**.
- **Authentication and Authorization** — modular auth **Options** (`authentication.methods[]`), explicit per-endpoint requirements.

Named market problems our proposals address:

- **#4 Authentication, consent & agent trust gaps** — agents lack a portable way to prove delegation or spending scope. Our **Mandate** method (a signed, capped, scoped, expiring authority that also serves as the settlement authorization) fills this.
- **#5 Payments & operational fragmentation** — the rail set has no LatAm real-money instrument. Our **PixPaymentMethod** (instant, government-auditable end-to-end id) fills this.
- **The missing delivery-evidence primitive** — order, pay, and returns exist, but nothing proves what was delivered. Our **`deliveryRecord`** (NF-e in Brazil) and **`controlRecord`** (a hash-chained mandate → order → payment → delivery receipt) close it.

## Our proposal

- [`pix-delivery-mandate-proposal.md`](./pix-delivery-mandate-proposal.md) — OAC v0.2 proposal: `PixPaymentMethod`, `deliveryRecord`, `Mandate` (settlement authorization), and `controlRecord`. Every field additive and optional; no breaking change to the manifest envelope. Ships with a working reference implementation.

## Related protocols (for context)

- **ACP** (OpenAI / Stripe) — the Agentic Commerce Protocol. See [`../acp/`](../acp/), including the Pix push-rail handler our Pix method mirrors.
- **AP2** (Google) — the Agent Payments Protocol; signed mandates the OAC spec calls itself complementary to. See [`../ap2/`](../ap2/).
- **x402** (Coinbase) — HTTP-native pay-per-call; the crypto signature is the settlement-authorization analog our Mandate mirrors for fiat.
- **KYA** (CodeSpar) — Know Your Agent; the mandate model here shares [`../kya/mandate-format-v3.md`](../kya/mandate-format-v3.md).

## Reference implementation

The additions are not speculative. In CodeSpar's stack an agent holding a Pix mandate pays a fixed-price resource, the BRL debit settles synchronously on the BCB rail with an `endToEndId`, and a hash-chained receipt binds mandate → payment; the NF-e attaches as the delivery link. We offer this as a working reference and can walk it through on a town hall.

## Attribution

The Open Agentic Commerce API and the *Empowering Merchant-Controlled AI Commerce* whitepaper are the work of Basis Theory and the Agentic Commerce Consortium. This repo reproduces none of that text; it links to the source and proposes additive extensions. Trademarks and specifications belong to their respective owners.
