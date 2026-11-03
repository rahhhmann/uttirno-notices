# Reconciliation — M4

The [database RevisionRepository](../../../../packages/database/src/revisions.ts) owns transactional source/canonical identity, immutable drafts and duplicate candidates. The domain owns pure normalization; the worker orchestrates through repositories.

Exact reviewed issuer/memo/post identity is required for automatic linking. Same URL or same bytes is insufficient. Ambiguity waits for separate human identity resolution with reason/audit. Original facts and evidence remain immutable. [M4 acceptance](../../../../docs/milestones/M4.md).
