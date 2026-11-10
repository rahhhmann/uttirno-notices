# Source configuration and approval

Versioned strict JSON schemas, canonical fingerprints, Ed25519 approval verification and independent collection/display decisions. Authority class, review expiry, scoped origins/paths/query keys and adapter sample evidence are checked before network. Candidate configs may be unsigned; active collection may not.

Trusted public keys come from a separately managed operator trust store, never from the proposal/source document. Configuration changes invalidate signatures. Trust/source loaders can be re-read at each gate for revocation. Signing is an explicit authorized-review operation, not an LLM/heuristic action.

A trusted reviewer attests to ownership, permission and fixture review; cryptography cannot prove those assertions are true. API/admin authorization and durable review history arrive in M4-M6. See [adaptation](../../docs/ADAPTATION.md).

[ADR0013](../../docs/decisions/0013-public-official-access.md) adds optional `publicAccessReview`: a dated operator public-access assessment can establish the local collection basis without pretending the authority issued written consent. `restricted`/`unavailable` assessments reject activation. This does not bypass signature, expiry, official eligibility, robots, network, retention or publication gates. Existing explicit-permission configs remain compatible.

Path rules may specify `exact:true`, useful for query-routed root notice pages; descendants are then denied. Existing prefix semantics remain compatible. HTML `attachmentAttributes` supports observed nonstandard PDF URL attributes as data, without executing site code or weakening URL gates.
