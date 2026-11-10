# Extraction, evidence and hallucination control

2026-11-10 real-source correction: text-layer words outside page geometry trigger bounded OCR for that page before strict provenance validation. Coordinates are not clipped or silently accepted. OCR/layout flags remain and engine fingerprint is `poppler-bbox-v2`; new text versions preserve the changed extraction provenance. This fixed an observed landscape BPSC PDF page-6 footer whose font bounds extended beyond the page. It does not establish semantic field accuracy.

## Pipeline
Acquire permitted bytes -> detect/validate file -> text layer -> OCR if needed -> preserve text/page map -> split by circular and position -> deterministic field extraction -> optional constrained LLM extraction -> evidence and semantic verification -> draft review.

Text extraction and OCR are measurable dependencies, not an assumed solved problem. Benchmark legacy Bangla fonts, scans, multi-column pages, merged tables, footnotes and attachments. Low confidence/ambiguous reading order requires review.

## Model contract
Document content is untrusted data, never instructions. No tools/network/credentials in the extraction call. Use only supplied document content. Return schema-valid candidates; absent facts remain explicitly absent. Copy original dates, fees and conditions verbatim. Keep conflicts, do not choose silently. Candidate fields include artifact/page/position evidence. Enforce context/cost/token limits and provider timeouts. Cache by document/config/prompt/model/schema versions. Model self-confidence is not a publication criterion.

## Verification layers
1. Schema/type/range and unknown-status checks.
2. Quote occurrence in the immutable text version, with offsets/page provenance.
3. Value supported by quote; normalization reproducible.
4. Quote belongs to selected position/circular and applicable exception category.
5. Cross-field consistency, fee/deadline distinction, totals and attachment coverage.
6. Conflicting official statements preserved; amendment precedence reviewed.
7. Critical fields and destination review before publication.

No guarantee of zero hallucination. The system reduces exposure by keeping unsupported candidates out of public data and measuring residual errors.

## Critical conditions
Wrong employer/title/post, deadline/timezone, fee/payment instructions, eligibility, cancellation state or application destination blocks affected publication. A general no-fee disclaimer is not a circular fee rule. No midnight, years of experience, equivalency or age relaxation may be inferred.

## Reprocessing
New extraction creates another draft tied to the same raw artifact, never modifies approved facts in place. Preserve engine/prompt versions, reviewer decisions and field lineage.

## Implemented in M3

Private local content-addressed bytes/capture/text storage, current signed collection/retention gates, bounded Poppler bbox + Tesseract ben/eng TSV, engine/model hashes, and field/page/position evidence are implemented. See [engine decision](decisions/0007-m3-document-extraction.md), [versioned plan format](../config/extraction/README.md) and [executed acceptance](milestones/M3.md).

The deterministic grammar currently uses literal labelled lines and explicitly reviewed whole-line ranges. Missing mappings default to not_extracted, not a claim of absence. Free-form prose/merged tables/legacy-font documents need reviewed adaptation; every native page requires quality/layout review. Optional model candidates must reproduce deterministic supported output. No real provider is configured. Preflight is not publication; durable inventory, authenticated approval and public projection remain M4/M5. Native subprocess controls are not production OS isolation.
