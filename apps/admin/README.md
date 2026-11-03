# Admin foundation

Separate Next.js app on port 3001 with a foundation notice only. No operational data, source activation, review mutations or authentication claims in M1. Actual authentication and admin workflows require M5/M6.

Use npm run dev:admin after shared package build. Component boundaries enforce API-mediated access; no direct database/server environment imports. See [plan](../../docs/TASKS.md).
