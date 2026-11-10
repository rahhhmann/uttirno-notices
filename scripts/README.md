# scripts

Workspace/build/boundary/local-service utilities plus explicit database/identity maintenance entry points are implemented. M8 adds [immutable release preflight](release-preflight.mjs) and [protected metrics/owned alert evaluation](monitor.mjs). No default cloud rollout, source activation, external message or destructive restore/purge. [Operations](../docs/OPERATIONS.md), [task boundaries](../docs/TASKS.md).

[Local Google setup](local-google.mjs) validates an owner-supplied web-client JSON and exclusively creates ignored local OIDC configuration without printing credentials or granting staff/source access. `npm run local:demo` starts the separate guarded synthetic browser rehearsal in [tests/local](../tests/local/demo.ts). See the [pipeline handover](../docs/PIPELINE_HANDOFF.md) for setup and the remaining live-source gates.

`npm run source:sign-local -- <reviewed-config>` invokes [local signing](sign-local-source.mjs) as an explicit operator action; it creates ignored local Ed25519 source/trust/private-key files, validates current policy and refuses production mode. It does not contact an authority or claim their consent. Use the printed source/trust paths with the agent `pipeline` command; keys must remain owner-only and outside Git.

`npm run sources:live -- [source-id ...]` invokes the explicit [real-source matrix](live-source-matrix.mjs) using the [versioned registry](../config/live-sources.v1.json). It runs sequential real acquisitions with system CA trust/TLS validation, bounded children and private reports; ordinary CI never runs it. Expired/rejected configs and incomplete documents fail visibly. `source:pipeline` supplies the same system-CA-enabled runtime for a single already-signed source. [Local guide](../docs/LOCAL_REAL_TEST.bn.md).
