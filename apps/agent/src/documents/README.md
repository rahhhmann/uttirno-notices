# Documents — M3

[Archive](archive.ts) stores private content-addressed bytes/captures/text with current signed collection + explicit retention checks, hashes and bounded reads. [Native engine](native.ts) uses local Poppler bbox text and Tesseract ben+eng TSV; records binary/model fingerprints, page/word offsets/boxes and quality flags. [Pipeline](pipeline.ts) connects the M2 broker and archive with config/byte lineage checks. Original PDFs remain separate from reconstructed text.

Limits: 10 MiB input, 20 pages, 16 MiB subprocess stdout, 30 seconds per tool, 60-second scheduling/90-second outer acquisition processing budget, 2400-pixel render edge, aggregate text/word limits. Native OS memory/egress isolation, production storage and purge remain release gates; these subprocess limits are not an exploit-proof sandbox. [M3 report](../../../../docs/milestones/M3.md).
