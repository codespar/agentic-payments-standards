# Push-rail (mandate-delegated) payment handler for ACP, with Pix as reference

**Status:** Draft proposal, to be upstreamed to
[`agentic-commerce-protocol`](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol)
via the SEP Proposal template. Authored by CodeSpar. Feedback welcome as issues here before we open the upstream PR.

## Summary

The ACP Delegated Payment Spec currently models one payment method: `payment_method.type: "card"` ("Currently only card."). Card is a **pull** rail: the credential is delegated, vaulted, and the merchant pulls funds.

This proposal adds a **push / mandate-delegated** payment handler class, with **Pix (Brazil)** as the reference implementation. Instead of delegating raw credentials, the buyer delegates a **consent/mandate reference** bounded by a spending cap. The PSP returns the same `vt_` vault token, and settlement happens by push under that mandate, confirmed asynchronously. Card behavior is unchanged; the change is additive.

## Motivation

- **The spec is card-first; the fastest-growing agentic markets are not.** In Brazil, Pix is the dominant rail and already supports pre-authorized recurring consent (Pix Automático), a native fit for autonomous agents. Bank transfer and stablecoin rails share the same shape (push under a pre-authorization), so a push handler class generalizes beyond Pix.
- **Autonomous agents need pre-authorization, not a card to pull.** A card credential is a bearer secret. A mandate is a scoped, capped, revocable authorization, which is what an agent operating without a human in the loop actually needs. This closes ACP's gap on non-card rails and aligns with the mandate-centric direction of AP2.
- **Concrete and testable.** CodeSpar runs Pix-under-signed-mandate end to end today (agent wallets, capped mandates, cryptographic receipts), with Pix settlement on sandbox rails pending production provisioning; the same mandate pattern already settles USDC over x402 on Base mainnet in production. We volunteer a reference PSP endpoint and a conformance test vector.

## Current behavior (context)

`spec/2026-04-17/openapi/openapi.delegate_payment.yaml` defines `POST /agentic_commerce/delegate_payment` with:

- `payment_method.type`: enum, currently `"card"` only. For `card`: `card_number_type` (`fpan` | `network_token`), `number`, `exp_month`, `exp_year`, `name`, `cvc`, optional cryptogram fields.
- `allowance`: `reason` (`one_time`), `max_amount`, `currency`, `checkout_session_id`, `merchant_id`, `expires_at`.
- Response `201`: `id` (`vt_…`), `created`, `metadata`.

## Proposal

### 1. New method type `pix` (first instance of a push/mandate-delegated class)

Make `payment_method` a discriminated `oneOf` on `type`. When `type` is `pix`, the object carries a mandate/consent reference instead of card credentials:

```yaml
payment_method:
  oneOf:
    - $ref: '#/components/schemas/CardPaymentMethod'   # unchanged
    - $ref: '#/components/schemas/PixPaymentMethod'     # new

PixPaymentMethod:
  type: object
  required: [type, consent]
  properties:
    type: { type: string, enum: [pix] }
    consent:
      type: object
      required: [consent_ref]
      properties:
        consent_ref:
          type: string
          description: PSP/issuer reference to a pre-authorized Pix consent (e.g. Pix Automático) or agent mandate.
        pix_key_type:
          type: string
          enum: [cpf, cnpj, email, phone, evp]
    mandate_proof:
      type: object
      description: Optional. Offline-verifiable signed mandate proving the agent is authorized.
      properties:
        format: { type: string }        # e.g. an Ed25519 dual-signed mandate token
        token:  { type: string }        # base64url signed token
```

### 2. Semantics

- `allowance` is reused unchanged (`max_amount`, `currency`, `expires_at`, `checkout_session_id`, `merchant_id`). For push rails it is the cap the PSP enforces against the consent.
- The PSP returns the same `vt_` token. When the merchant charges the token, the PSP **initiates a Pix debit under the consent** (push) rather than pulling a card.
- Consider adding `recurring` to `allowance.reason` for standing consents, or keeping `one_time` for a single mandated debit (open question).

### 3. Asynchronous settlement via capability negotiation

Card auth is synchronous; Pix confirmation is asynchronous (seconds). ACP already introduced capability negotiation (`spec/2026-01-16/`). A push handler advertises `settlement: async`; the existing order lifecycle webhooks (`order_updated`) carry the `pending → paid` transition, so completion does not block on final settlement. No new webhook is required.

### 4. Backward compatibility

Purely additive. Existing card payloads validate unchanged; `allowance`, the vault-token response, and error codes are untouched.

## Files the upstream PR would touch

- `spec/unreleased/openapi/openapi.delegate_payment.yaml` — add `PixPaymentMethod`, discriminated `oneOf`.
- `spec/unreleased/json-schema/` — corresponding models.
- `examples/unreleased/` — a `type: pix` delegate_payment example.
- `changelog/unreleased/` — changelog entry.
- `rfcs/rfc.push_rail_payment_handler.md` — this document, cross-referencing `rfc.payment_handlers.md`.

## Open questions

1. `allowance.reason`: add `recurring`, or keep push rails to `one_time` mandated debits in v1?
2. Generalize the push class now (`bank_transfer`, `stablecoin`) or land Pix first and generalize on the second implementation?
3. Is `mandate_proof` in scope for ACP, or should cryptographic agent authorization stay out-of-band (referenced, not carried)?
4. Refund/reversal semantics for push rails (Pix devolução) vs card refund.
