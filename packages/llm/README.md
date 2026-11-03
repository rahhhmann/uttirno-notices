# Optional constrained JSON extraction gateway — M3

JsonExtractionProvider implements an explicitly documented gateway contract, not an assumed vendor SDK endpoint. Deterministic extraction works without it or an API key. No live provider is configured or tested by M3.

Operator supplies an approved HTTPS endpoint/model, secret header credential, processor review expiry, input/output/time/session token/cost limits. Requests use protocol uttirno-extract-v1, versioned prompt/schema, cache identity, text-only system/user messages, tools=[], tool_choice=none, responseSchema and max_output_tokens. Gateway must return application/json with {positions:[...]} matching the schema. Redirects fail. Input budgeting includes the wire schema/messages; reserve once before I/O and do not refund failed requests. Billing safety depends on a trusted gateway honoring output limits and configured pricing; actual vendor usage accounting remains an integration gate.

All outputs must exactly reproduce deterministic supported candidates; unsupported facts, omissions, injected tools or altered scope are rejected. There is no agent capability object, credentials in prompts, browsing, shell, retry loop or autonomous publishing. Errors are sanitized. Cache keys include document/config/plan/prompt/schema/model input; durable cache is not implemented.

[Versioned prompt](src/prompt.v1.json), [injection/budget tests](src/index.test.ts), [M3 report](../../docs/milestones/M3.md).
