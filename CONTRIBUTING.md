# Contributing

This repo holds CodeSpar's open contributions to agentic payment standards. Two kinds of things live here:

1. **Reference artifacts we maintain** (the KYA format and verifier). Issues and PRs welcome. The verifier is intentionally dependency-free; please keep it that way.
2. **Proposals we intend to upstream** (the ACP push-rail handler, the AP2 mapping). The canonical home for those protocols is upstream; the versions here are drafts we socialize before opening the upstream PR. If you want to co-author the upstream submission, open an issue.

## Ground rules

- Keep the verifier reproducible: no third-party dependencies, standard-library crypto only.
- Documented formats must stay byte-exact with a test vector. If you change the canonical string, update the vector.
- No secrets, no internal endpoints, no customer data in this repo. Ever.
