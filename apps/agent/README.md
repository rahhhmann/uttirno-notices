# Agent foundation

TypeScript application entrypoint validates server configuration only. After building: npm run start --workspace @uttirno/agent -- check-config. Unknown commands fail; no acquisition or source execution occurs in M1.

Generic policy-gated acquisition/adaptation is M2; PDF/OCR/extraction/verification is M3. Historical code is isolated under [research](../../research/prototype/README.md) and cannot be imported. See [plan](../../docs/TASKS.md).
