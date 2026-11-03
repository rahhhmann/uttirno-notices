# Worker foundation

TypeScript entrypoint validates configuration only: npm run start --workspace @uttirno/worker -- check-config after a build. No schedule or queue execution yet.

Leases, retries, stage checkpoints and job handlers arrive in M4. Worker can never approve its own extraction for publication. See [plan](../../docs/TASKS.md).
