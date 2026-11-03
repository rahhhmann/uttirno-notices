# Current state

Updated: 2026-11-03.

## Completed

- M0 planning and M1 executable foundations. [M1 report](milestones/M1.md).
- M2-T01–T04 source trust, secure acquisition, configurable adaptation and observed source drafts. [M2 report](milestones/M2.md).
- M3-T01–T04 private immutable artifact/text archive, bounded Poppler/Tesseract, position-scoped field contracts/derivations, optional constrained JSON gateway and evidence/semantic/coverage preflight. [M3 report](milestones/M3.md).
- 121 unit + 4 prototype + 9 real integration cases passed; all app/package builds, types, boundaries and built HTTP smoke passed. [Synthetic PDF/OCR benchmark](research/M3-benchmark.json).
- M2 remote CI was independently verified successful. M3 remote CI must be checked against its own pushed commit/run.

## Sources and data

Both real configs remain unsigned candidates. Collection, display and retention remain unresolved; no production source activation, PDF collection or applicant processing was enabled. External object-storage origins stay quarantined; Alljobs permission-pending. Synthetic generated PDFs are explicitly labelled, checksummed and contain no actual vacancies.

The archive is a private local backend with policy rechecks, scoped retention and hash verification. Production object storage, OS parser isolation, automated purge and DB metadata are not complete. Model integration is optional, gateway-contract tested with mocked transport only, and has no configured live provider/key.

Native PostgreSQL on 5432 remains separate. Development containers use 55432/56379/54566 and retained volumes. Root .env is local/ignored. [Development](DEVELOPMENT.md).

## Remaining

M4–M9: persistent schemas/revisions/lifecycle/publication, queues/leases, authentication/admin workflows, actual job portal features, deployment and real-source/gold-set acceptance. Portal/Admin still show foundation notices; API has health routes only.

## Approval boundary

M3 was explicitly authorized and is complete. STOP. Do not start M4 without the user's explicit authorization, including after model/session changes. Next task after authorization: M4-T01 in [tasks](TASKS.md).

## Conditions to preserve

One acquisition broker process until distributed host leases. No source activation or fake approval to make a demo pass. Literal labelled-line extraction needs reviewed mappings/scopes; unsupported layouts, OCR quality and missing inventories remain unresolved. M3 preflight never publishes. See [M3 limits](milestones/M3.md) and [open questions](OPEN_QUESTIONS.md).
