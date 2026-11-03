# ADR 0003 — Configurable primitives with adapter escape hatch
Status: accepted.

Decision: Source-specific URLs/selectors/field mappings/pagination/taxonomy in reviewed, versioned configuration. Core engine consumes generic typed primitives. Specialized adapters implement a common interface only for unsupported behavior. Onboarding agent proposes, real fixtures verify, authorized review enables. Never execute model-generated code.

Consequence: most new similar sources need config only; novel technology may require an adapter. No claim that every site works automatically. Original job titles are arbitrary data, category aliases optional; adding a title never requires collector code changes. Existing source-specific prototype is not the implementation of this decision.
