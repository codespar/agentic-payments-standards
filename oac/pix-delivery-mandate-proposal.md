# OAC v0.2 proposal: Pix, delivery records, and agent mandates

**Status:** CodeSpar's contribution to the Basis Theory **Open Agentic Commerce (OAC)** spec / **Agentic Commerce Consortium**. Extends OAC v0.1.0. All changes are additive and optional: a v0.1 merchant omits these fields and a v0.1 agent ignores them, with no breaking change to the manifest envelope.

Three additions where CodeSpar (LatAm rails + governance) contributes. Related work in this repo: the mandate here shares the model documented in [`../kya/mandate-format-v3.md`](../kya/mandate-format-v3.md), and the Pix method mirrors the push-rail handler proposed for ACP in [`../acp/pix-push-rail-sep.md`](../acp/pix-push-rail-sep.md).

## 1. PixPaymentMethod

A new `payments.acceptedPaymentMethod[]` type. Pix is Brazil's real-money instant rail, with a government-auditable end-to-end id.

```json
{ "type": "pix", "country": "BR", "keyTypes": ["cpf","cnpj","email","phone","evp"], "dynamic": true, "instant": true }
```

The `pay` result for a Pix order carries the copia-e-cola (EMV) plus the BCB end-to-end id:

```json
{ "paymentStatus": "pending|settled", "paymentReference": "E2026...<endToEndId>", "qrCode": "00020126...<EMV>", "expiresAt": "..." }
```

Why: the current `acceptedPaymentMethod` set covers card, crypto, wallets, and bank, but has no LatAm real-money rail. Pix settles instantly with an auditable id.

## 2. deliveryRecord

A capability flag plus a record on the order/pay result (or `GET {endpoints.orders}/{id}/delivery`). The spec has order, pay, and returns, but no delivery-evidence primitive.

```json
"capabilities": { "deliveryRecord": true }
```
```json
"deliveryRecord": {
  "type": "nfe",
  "issuer": "gov",
  "key": "3526...<44-digit access key>",
  "url": "https://.../danfe.pdf",
  "issuedAt": "..."
}
```

`type`: `nfe` (BR), `cfdi` (MX), `factura`, or `shipment` / `confirmation` (generic). `issuer`: `gov` (validated) or `merchant` (attested).

Why: order to pay to returns exists, but nothing proves what was delivered. In LatAm the NF-e is a government-validated delivery record. This binds payment to delivery, the evidence layer the deterministic-totals flow implies.

## 3. Mandate

A new `authentication.methods[]` type plus an object the agent presents on order and pay. Closes the gap where agents have no portable way to prove delegation or spending scope.

```json
{ "type": "Mandate", "header": "X-Agent-Mandate", "format": "JWS" }
```
```json
"mandate": {
  "id": "mnd_...",
  "principal": "user/...",
  "scope": "groceries",
  "caps": [{ "currency": "BRL", "amount": 80000, "period": "month" }],
  "expiresAt": "...",
  "sig": "..."
}
```

Why: the spec assumes the agent is already trusted. A signed mandate is the agent-side authority (who authorized it, limits, scope, expiry), aligned with the AP2 signed mandates the spec says it is complementary to.

The mandate is also the settlement authorization, not only a delegation credential. Presented on `pay` for a Pix order, it authorizes the BRL debit in the same request, the fiat analog of the crypto signature the spec already accepts under x402 / eip-712. So PixPaymentMethod and Mandate compose: one authorization, settlement in band, bounded by the mandate's allowlist, per-transaction cap, and expiry. Fiat gets the same "authorize once, settle in the request" property the crypto rails have, with no card-network round trip.

## 4. controlRecord

The spec has order, pay, returns, and (above) delivery, but nothing binds them into one verifiable artifact. A Control Record hash-chains the four links, mandate to order to payment to delivery, into a single tamper-evident receipt the buyer, merchant, or a dispute resolver can verify offline without calling either party.

```json
"controlRecord": {
  "id": "rcpt_...",
  "links": { "mandate": "mnd_...", "order": "ord_...", "payment": "E2026...<endToEndId>", "delivery": "3526...<nfe key>" },
  "chain": "<hash>",
  "sig": "<merchant/issuer signature>"
}
```

Why: the deterministic-totals and returns flows imply an evidence layer but do not close it. The Control Record is that layer. `deliveryRecord` (section 2) is one link in it; the Pix `endToEndId` and the mandate id are the others. Returns and chargebacks resolve against the record, not a support thread.

## Reference implementation

These additions are not speculative. They run today in CodeSpar's stack: an agent holding a Pix mandate pays a fixed-price resource, the BRL debit settles synchronously on the BCB rail with an `endToEndId`, and a hash-chained receipt seals mandate to payment; the NF-e attaches as the delivery link. We offer this as a working reference for the spec and can walk it through on a town hall.

## Backward compatibility

Every field above is optional. A v0.1 merchant omits them; a v0.1 agent ignores them. No breaking change to the envelope.
