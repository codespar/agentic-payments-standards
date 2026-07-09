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

## Backward compatibility

Every field above is optional. A v0.1 merchant omits them; a v0.1 agent ignores them. No breaking change to the envelope.
