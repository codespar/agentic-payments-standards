# Agentic Payments Standards

Open contributions from **CodeSpar** to the standards that let AI agents move money safely: verifiable agent identity and mandates (KYA), and non-card payment rails (like Pix) in agentic checkout protocols.

CodeSpar builds payments infrastructure for AI agents, LATAM-first. This repository is where we publish the open, reproducible pieces of that work so anyone can verify, reuse, and challenge them.

## Contents

- **[`kya/`](./kya)** — *Know Your Agent*. A signed-mandate and receipt format plus a dependency-free offline verifier. Anyone can check an agent's authorization with a few lines of `node:crypto`: no SDK, no API key. This is the "how does the other side trust the agent" primitive.
- **[`acp/`](./acp)** — a proposal to extend the [Agentic Commerce Protocol](https://github.com/agentic-commerce-protocol/agentic-commerce-protocol) (OpenAI + Stripe) with a **push-rail / mandate-delegated** payment handler, with **Pix** as the reference implementation. Today ACP is card-first; agents on push rails need pre-authorization, not a card to pull.
- **[`oac/`](./oac)** — a proposal to the Basis Theory **Open Agentic Commerce (OAC)** spec / **Agentic Commerce Consortium**, adding a Pix payment method, a delivery-record (NF-e) primitive, and an agent mandate. Additive and optional.
- **[`ap2/`](./ap2)** — a mapping between CodeSpar mandates and Google's [Agent Payments Protocol (AP2)](https://cloud.google.com/blog/products/ai-machine-learning/announcing-agents-to-payments-ap2-protocol).

## Why this is public

The thesis behind KYA is simple: **whoever verifies should not have to ask permission from whoever issued.** The math is public, the format is documented, and the verifier is a few lines you can read. Standards for agentic money should be reproducible by anyone, not a black box.

## License

MIT. See [`LICENSE`](./LICENSE).

## Links

- Trust page: https://codespar.dev/trust
- Docs: https://docs.codespar.dev
