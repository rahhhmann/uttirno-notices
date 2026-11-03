# Extraction — M3

Position-scoped deterministic extraction lives in [domain](../../../../packages/domain/src/extraction.ts); strict schemas in contracts, optional text-only gateway in llm. [Document pipeline](../documents/pipeline.ts) orchestrates them. This avoids duplicate business rules in agent/worker/API.

Versioned literal-label plans and complete-line nonoverlapping ranges are operator-reviewed data. Missing mapping stays not_extracted; unknowns are not fabricated. Arbitrary titles need no enum/code edit. Unsupported prose/tables need reviewed adaptation. [Plan format](../../../../config/extraction/README.md).
