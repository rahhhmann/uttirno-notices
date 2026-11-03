# API foundation

Fastify application factory and server entrypoint. M1 implements GET /health/live and real dependency-backed GET /health/ready; no /v1/jobs or administrative routes yet. Not-ready responses are sanitized and return 503.

Run through npm run dev:api at the root after building packages and configuring the ignored root environment. The app factory has lifecycle-safe tests and can be closed after injected requests. Domain APIs/authentication are M5. See [plan](../../docs/TASKS.md).
