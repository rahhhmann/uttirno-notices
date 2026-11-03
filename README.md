# Uttirno — Official Job Intelligence & Portal

Agent + public job portal + admin review system for verified official Bangladesh recruiting authorities only.

**বর্তমান অবস্থা:** M1–M4 সম্পন্ন: foundation, source adaptation, document extraction, persistence/revisions এবং durable worker/publication gates। Real sources এখনও unsigned candidates। API/auth, admin UI ও public job features পরবর্তী milestones-এর কাজ; production readiness দাবি করা হচ্ছে না।

## Start here

1. [Project and scope](docs/PROJECT.md)
2. [Structure](docs/STRUCTURE.md)
3. [Architecture](docs/ARCHITECTURE.md)
4. [Requirements](docs/REQUIREMENTS.md)
5. [Tasks](docs/TASKS.md)
6. [Status](docs/STATUS.md)
7. [Working rules](AGENTS.md)
8. [M4 acceptance and limits](docs/milestones/M4.md)

## Components

- [Portal](apps/portal/README.md), [admin](apps/admin/README.md), [API](apps/api/README.md).
- [Agent](apps/agent/README.md), [worker](apps/worker/README.md), [shared packages](packages/README.md).
- [Development](docs/DEVELOPMENT.md), [extraction](docs/EXTRACTION.md), [release gates](docs/RELEASE.md).

Run npm ci, npm run check and npm run build. Native PDF/OCR integrations require Poppler and Tesseract with ben+eng installed; see development setup. The deterministic path needs no AI key.

The original [research prototype](research/prototype/README.md) remains isolated and disabled. Its four tests remain regressions, not production acceptance. No Bdjobs or third-party job aggregator is eligible.
