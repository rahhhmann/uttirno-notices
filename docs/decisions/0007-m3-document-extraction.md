# ADR 0007 — Bounded documents and reproducible field candidates

Status: accepted for M3; not a production release decision.

Use native Poppler bbox text and Tesseract ben+eng TSV behind an argv-only subprocess interface. The synthetic benchmark compares hybrid text-first/fallback OCR with forced OCR using the same fixtures. Hybrid is selected for intact text layers; signed source configuration can force OCR for reviewed legacy/mixed-image layouts. Record binary versions, traineddata SHA-256 values, parser/options version and immutable text hash. No Python runtime or new cloud service is required.

Keep original bytes and captures in a private local content-addressed archive. Exclusive hard-link creation prevents application overwrites; reads check hashes, size, lineage, current signed collection policy and explicit signed retention grants. This is a local backend, not WORM storage or production S3/object-lock acceptance. DB metadata, distributed orchestration, storage service deployment and automated purge remain M4/M8 work. Revocation immediately denies reads/new processing; it does not claim that private bytes have already been purged.

Deterministic extraction uses versioned, operator-reviewed literal labels and explicit nonoverlapping whole-line position ranges. It supports arbitrary titles and all required field envelopes, not universal understanding of arbitrary tables or free-form notices. Missing mappings default to not_extracted. A reviewed mapping can explicitly classify absence as not_stated. Bangla digits, dates with date/time precision, BDT amounts/categories and age reference dates have versioned derivations. Other conditions retain original text. Unsupported syntax stays unresolved.

The verifier reproduces each field from the immutable text and approved mapping intent: same source/artifact/text/page/range/quote/value/derivation. A quote existing elsewhere is insufficient. Conflicts, unsupported values, missing inventory, unreviewed scopes/quality, unknown critical fields and unapproved destinations fail preflight. Scope review binds the entire plan and text hash, not a mutable version label alone. M3 returns publicationApproved=false even for successful preflight; authenticated durable approval/public projection is M4/M5.

The optional JSON extraction gateway uses a versioned text-only protocol, empty tools, strict response schema, endpoint redirects disabled, deadlines, bounded bodies and pre-reserved session token/cost budgets. Its output must reproduce deterministic candidates; broader model-derived interpretations are not accepted. The gateway is an explicit integration contract, not an invented vendor API. No live provider is configured or called in M3. Deployment requires actual processor approval, endpoint/model validation and provider-specific accounting. No key is needed for the deterministic pipeline.

## Limits

OS-level parser memory/filesystem/egress isolation, production object-store permissions and retention purge remain release gates. Native subprocesses have scrubbed environments, temporary local inputs, output/time/page limits and sanitized errors, but are not claimed to be an exploit-proof sandbox. Text plus images on the same page and legacy fonts can require forceOcr and human review; automatic text completeness is not proven. Every extracted page carries layout review flags; OCR adds OCR/confidence flags. No source permissions, real gold labels, 98% accuracy or zero-hallucination guarantee are inferred from synthetic tests.

Tool references: [Tesseract CLI/TSV](https://tesseract-ocr.github.io/tessdoc/Command-Line-Usage.html), [Poppler pdftoppm](https://manpages.debian.org/unstable/poppler-utils/pdftoppm.1.en.html).
