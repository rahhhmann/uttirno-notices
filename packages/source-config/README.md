# Source configuration and approval

Versioned strict JSON schemas, canonical fingerprints, Ed25519 approval verification and independent collection/display decisions. Authority class, review expiry, scoped origins/paths/query keys and adapter sample evidence are checked before network. Candidate configs may be unsigned; active collection may not.

Trusted public keys come from a separately managed operator trust store, never from the proposal/source document. Configuration changes invalidate signatures. Trust/source loaders can be re-read at each gate for revocation. Signing is an explicit authorized-review operation, not an LLM/heuristic action.

A trusted reviewer attests to ownership, permission and fixture review; cryptography cannot prove those assertions are true. API/admin authorization and durable review history arrive in M4-M6. See [adaptation](../../docs/ADAPTATION.md).
