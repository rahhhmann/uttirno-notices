# Server environment

Validated server-only configuration shared by API/agent/worker. Reads ignored root environment configuration explicitly at startup; no import-time I/O. Errors identify variable names without values. AI provider/key/model are optional together; deterministic operation needs no AI credential. Never import this package into portal/admin.
