# ADR 0004 — Draft-first evidence and revision publication
Status: accepted.

Decision: Immutable permitted source artifacts and extraction versions; position-scoped field evidence and explicit unknown/conflict states; deterministic plus semantic checks; review before publication. Public API reads approved projection only. Critical correction/cancellation suppresses affected stale facts pending review. Failures never silently replace approved facts.

Consequence: more review/storage cost, but every published value is traceable and corrections reversible. Quote matching is necessary but insufficient. Model confidence cannot replace source evidence. No zero-hallucination guarantee; measure and block unsupported output. Release requires adjudicated real evaluation and operational acceptance.
