# Uttirno Notices — Developer Handoff Guideline

> তৈরি: ২০২৬-১১-১০। এই ফাইল `uttirno-notices-main` repo-র docs (`STATUS.md`, `TASKS.md`, `M9.md`, `PIPELINE_HANDOFF.md`, `OPEN_QUESTIONS.md`, `AGENTS.md`) পড়ে এবং Windows মেশিনে local build/demo চালানোর অভিজ্ঞতা থেকে লেখা।
>
> **গুরুত্বপূর্ণ:** লেখক নিজে পুরো pipeline চালিয়ে যাচাই করেননি। "শেষ" বলতে বোঝানো হয়েছে repo-র `docs/TASKS.md`-এ চেক করা task। কোনো দাবি সন্দেহ হলে মূল doc ও code আগে দেখো। কোন অংশ যাচাই করা, কোনটা শুধু doc থেকে নেওয়া, সেটা প্রতিটা section-এ বলা আছে।

---

## ১. প্রজেক্ট কী

Bangladesh-এর **official** recruiting authority (BPSC, BCC, Bangladesh Bank, public university ইত্যাদি) -র website থেকে job notice এনে, PDF থেকে text/OCR করে, মানুষের review-এর পর **Uttirno**-র portal-এ দেখানোর pipeline।

প্রবাহ:

```
Official website → Source gate (robots/origin/DNS/signature)
  → Notice discovery → PDF capture + hash → Text / OCR
  → Position/field mapping (extraction plan)
  → Draft → Independent review (Admin) → Approve
  → Public API → Portal (/jobs)
```

মূল নিয়ম: **অনুমোদিত না হলে কোনো data public-এ যায় না।** নতুন extraction কখনো published revision overwrite করে না।

## ২. Repo structure

| Path | কাজ |
|---|---|
| `apps/api` | Public + admin API (Fastify), OIDC login, session |
| `apps/worker` | Scheduled acquisition, queue (BullMQ), stage/lease |
| `apps/agent` | Fetch, discovery, PDF extraction, CLI |
| `apps/portal` | Public UI (`/jobs`, `/jobs/<id>`), Next.js |
| `apps/admin` | Staff console (review, sources, audit), Next.js |
| `packages/*` | contracts, domain, database, source-config, env, llm, ui, api-client ইত্যাদি |
| `config/sources/` | Source config (JSON) |
| `config/live-sources.v1.json` | Real-test registry (৫টা source) |
| `config/extraction/` | Extraction plan-এর contract |
| `infra/local`, `infra/deployment` | Docker Compose (local dev, deployment template) |
| `docs/` | সব spec, ADR, milestone report |
| `research/prototype` | পুরনো prototype, production code এটা import করে না |

**Boundary নিয়ম:** Portal/admin শুধু API ডাকে। Database ধরে শুধু `packages/database`। Agent/worker UI import করে না। (`npm run check:boundaries` এটা যাচাই করে।)

প্রথমে পড়ো: `AGENTS.md`, তারপর `docs/PROJECT.md`, `ARCHITECTURE.md`, `REQUIREMENTS.md`, `STATUS.md`, `TASKS.md`।

## ৩. Local setup (Windows PowerShell-এ যাচাই করা)

Requirements: Node `24.19.x` (`>=24.19.0 <25`), npm `11`, Docker Desktop। Real PDF test-এর জন্য Poppler (`pdfinfo`, `pdftotext`, `pdftoppm`) আর Tesseract-এ `ben` + `eng` language data।

```powershell
npm ci
npm run local:init        # প্রথমবার, random .env বানায়, overwrite করে না
npm run local:up          # Postgres :55432, Redis :56379, S3 emulator :54566
npm run check:services
npm run build
```

### Known gotcha: `NODE_ENV`

যদি shell-এ `NODE_ENV=development` সেট থাকে, `npm run build`-এ admin app `/_global-error` prerender-এ `Cannot read properties of null (reading 'useContext')` দিয়ে ফেল করে। এই ক্ষেত্রে এটা কাজ করেছে:

```powershell
Remove-Item Env:NODE_ENV
Remove-Item -Recurse -Force apps\admin\.next
npm run build
```

(এটা environment variable ছাড়া `.env` ফাইলের `NODE_ENV` নিয়ে নয়। সমস্যা ছিল shell-এর variable।)

## ৪. Local demo (synthetic data)

```powershell
npm run local:demo              # reviewer role
npm run local:demo -- admin     # administrator role (roles: reviewer, operator, approver, admin)
```

- Portal: `http://127.0.0.1:3000/jobs?lang=en` (approve-এর আগে খালি থাকা ঠিক)
- Staff: `http://127.0.0.1:3001` → **Continue with SSO** (local fictional user)
- Terminal-এর `Review:` URL → original ও field মেলাও, confirmation tick, reason লেখো, **Approve** → portal-এ ২টা fictional position আসে।
- `Ctrl+C` দিলে temporary schema মুছে যায়। `npm run local:down` ব্যবহার করো, `down -v` নয়।
- Port `3000`, `3001`, `4000` ফাঁকা থাকতে হবে।

এটা **fictional data**, real-source acceptance নয়।

### Admin panel (একটাই, role অনুযায়ী access)

| Route | কী | লাগে |
|---|---|---|
| `/` | Overview | যেকোনো staff |
| `/sources`, `/sources/onboard` | Source list / authority + config register | onboard-এ `source_approver` |
| `/reviews`, `/reviews/<id>` | Review queue ও approve | `reviewer` |
| `/duplicates`, `/events` | Duplicate ও notice-event case | `reviewer` (case খুলতে) |
| `/operations` | Run/stage health | যেকোনো staff |
| `/audit` | Audit log | `administrator` |

`administrator` সব role-এর কাজ করতে পারে (`hasRole` code দেখে নিশ্চিত)। Onboarding page শুধু offline preview আর register করে, **কিছু fetch করে না, signing-ও করে না**।

## ৫. Real source test (শুধু text acquisition)

```powershell
npm run sources:live                      # ৫টা source পরপর
npm run sources:live -- bpsc-authority    # একটা
```

শেষে `Review matrix:`-এর পরের HTML report খোলো। `needs_review` = collection ও text extraction সফল। `incomplete`/error = ব্যর্থ।

Docs-এর রেকর্ড (২০২৬-১১-১০): BPSC authority (৩ PDF/২৯ page), BPSC Teletalk (২/১৮), BCC (১/১), Bangladesh Bank (৩/৪), BUET (২/৪) — মোট ১১ PDF copy, ৫৬ page, ৯টা unique hash।

সতর্কতা:

- BPSC local config-এর মেয়াদ **২০২৬-১১-১৭ পর্যন্ত** (৭ দিন)। এরপর নতুন assessment ও sign লাগবে।
- Bangladesh Bank-এর **e-Recruitment** endpoint request reject করেছে, bypass করা হয়নি। শুধু main notice board source-এ আছে।
- Teletalk-এ প্রথমবার `TRANSPORT_FAILED` এসেছিল, `--use-system-ca` দিয়ে সফল। কারণ নিশ্চিত নয়। **TLS verification কখনো বন্ধ করবে না।**
- সব original ও extracted text private/ignored folder-এ থাকে। Git বা public hosting-এ দিও না। Automatic purge নেই, নিজে মুছতে হবে।
- এই test থেকে data portal-এ আসে না, কারণ position mapping নেই (নিচে দেখো)।

## ৬. যা শেষ হয়েছে

`docs/TASKS.md` গুনে: **৩৪টা task-এর মধ্যে ২৬টা শেষ।**

| Milestone | বিষয় | অবস্থা |
|---|---|---|
| M0 | Scope, requirements, ADR, runbook | শেষ |
| M1 | Workspaces, strict TS, local services, CI | শেষ |
| M2 | Source gate (robots, throttle, SSRF/DNS/redirect), generic adapter, config | শেষ |
| M3 | PDF text/OCR (Poppler + Tesseract), evidence, verifier | শেষ |
| M4 | Database, dedup, worker/lease, approve/publish/suppress | শেষ |
| M5 | Public API, OIDC, roles, session/CSRF, API client | শেষ |
| M6 | Admin console (source, review, health, audit) | শেষ |
| M7-T01/T02 | Portal shell, jobs list/search/detail (Bangla/English) | শেষ |

Docs-এ রেকর্ড করা automated test: ২১৪টা (150 unit + 4 prototype + 48 integration + 12 browser)। লেখক নিজে এগুলো চালাননি।

লেখক নিজে যা চালিয়ে দেখেছেন: `npm run build` (NODE_ENV ঠিক করার পর), `npm run local:demo -- admin` চালু হওয়া।

## ৭. যা বাকি

### ৭.১ খোলা ৮টা task

| Task | কাজ | আটকে আছে কেন |
|---|---|---|
| **M9-T01** | BPSC-র আসল notice: plan লেখা → worker → draft → review → approve → portal | আসল position/field mapping নেই |
| **M7-T03** | একটা approved real record দিয়ে browser E2E + accessibility audit | M9-T01-এর ওপর নির্ভরশীল |
| **M9-T02** | BCC, Bangladesh Bank, BUET আলাদা করে একই gate-এ | M9-T01 আগে |
| **M9-T03** | ১৫০ record-এর adjudicated gold set | স্বাধীন মানুষ লাগবে (নিচে) |
| **M8-T01** | Staging deploy (container, secret, migration, rollback) | hosting/domain/SSO সিদ্ধান্ত |
| **M8-T02** | Metrics, alert, source kill switch, incident drill | alert owner ও channel |
| **M8-T03** | Backup/restore, takedown, security review, load/SLO | hosting, volume, SLO লক্ষ্য |
| **M9-T04** | Requirements audit, release gate report, production rollout | বাকি সব |

### ৭.২ কেন real extraction সহজে হচ্ছে না (সবচেয়ে বড় technical gap)

PDF থেকে **text** আনা কাজ করছে। কিন্তু text → "কোন পদ, কত বেতন, বয়স, শেষ তারিখ" এই mapping এখনো **হাতে লেখা plan** দিয়ে হয়।

- Mapper শুধু literal `Label: value` ধরনের লাইন বোঝে। Label প্রতিটা document-এর plan-এ দিতে হয়।
- Plan একটা **exact URL + artifact hash**-এর সাথে বাঁধা। PDF বদলালে বা নতুন circular এলে worker **pause** করে।
- Free-form paragraph, merged table, পুরনো Bangla font: docs বলছে "reviewed adaptation" লাগবে। Arbitrary layout-এ কাজ করে এমন প্রমাণ নেই।
- OCR page-এ সংখ্যা/বানান ভুলের ঝুঁকি আছে, তাই প্রতিটা page review লাগে।
- LLM extraction optional আর কোনো provider configured নেই। ইচ্ছা করে AI ছাড়া রাখা, hallucination এড়াতে।
- Label না মিললে system "extract হয়নি" ধরে, "notice-এ নেই" ধরে না। `not_stated` দেওয়ার আগে original দেখে নিশ্চিত হতে হয়।

Plan-এর format: `config/extraction/README.md` আর `packages/contracts/src/extraction.ts` (`ExtractionPlanSchema`)। Synthetic উদাহরণ: `tests/helpers/extraction.ts`। Worker চালানোর command: `apps/worker/README.md` (plan registry JSON = exact URL → `{artifactSha256, plan}`)।

### ৭.৩ Uttirno-র সাথে integration (task list-এর **বাইরের** কাজ)

এটা ৮টা task-এর মধ্যে নেই, কিন্তু আসল লক্ষ্য। Docs-এ এটা **Q08** (open question)। Uttirno-র web app-এর code, router, design assets `uttirno-notices` repo-তে ছিল না, তাই host integration **একবারও চালানো হয়নি**।

যা জানা দরকার:

- Uttirno-র web app কী দিয়ে বানানো (framework), কোথায় host করা, router কার হাতে
- Public jobs কোথায় বসবে: প্রস্তাব `uttirno.org/jobs`, না হলে `jobs.uttirno.org` (`docs/research/uttirno-integration-review-2026-11-05.md`)। **এটা প্রস্তাব, সিদ্ধান্ত নয়।**
- Approved brand token, header/footer, dark mode, mobile navigation
- Job category / exam track → Uttirno-র preparation destination-এর reviewed mapping। Mapping না থাকলে preparation button বাদ দেবে, আন্দাজে link দেবে না।
- Staff login-এর real OIDC provider ও লোকজনের role

Contract (host যা ডাকবে): `GET /v1/jobs`, `/v1/jobs/:id`, `/v1/jobs/:id/events`, `/v1/authorities`। বিস্তারিত `docs/API.md`, `packages/api-client/README.md`।

Portal-এর settings (Next process-এ export): `PORTAL_API_ORIGIN`, `PORTAL_HOME_URL`, `PORTAL_BRAND_NAME`, optional `PORTAL_PREPARATION_LINKS` (JSON array `{category,label,url}`, সর্বোচ্চ ২০, একই HTTPS home origin)। Admin-এর জন্য `ADMIN_API_ORIGIN`, `ADMIN_HOME_URL`, `ADMIN_BRAND_NAME`, আর API-তে `ADMIN_ORIGIN`। বিস্তারিত `docs/ADMIN_HANDOFF.md`।

Login মডেল:

| কে | Login |
|---|---|
| সাধারণ user (portal) | লাগে না, anonymous |
| Staff (admin) | OIDC/SSO, আলাদা restricted URL, exact issuer+subject+role বাঁধা |
| Uttirno-র student account | **scope-এর বাইরে** |

Staff login দিয়ে consumer feature বা consumer login দিয়ে admin পাওয়া যায় না। Shared password, shared DB, broad domain cookie shortcut নিষিদ্ধ।

Integration শেষে acceptance (docs থেকে): main-site jobs navigation, deep link refresh/share, preparation-এ ফেরা, theme/language state, login/logout/expiry/role, draft/private data leak নেই, revoked fact সরে যায়, worker ফেল করলেও preparation product চলে, performance ও rollback মাপা।

Portal এখন **`noindex`**। SEO, sitemap, canonical, JobPosting যোগ হয়নি। Host routing/canonical ঠিক হওয়ার পরেই `noindex` তুলবে।

### ৭.৪ যেগুলো মানুষের সিদ্ধান্ত বা কাজ (code দিয়ে শেষ হয় না)

`AGENTS.md` স্পষ্ট বলে: hosting, identity, alert owner, source permission, independent reviewer, load target "invented" করে milestone complete দেখানো যাবে না।

| ID | দরকার |
|---|---|
| Q01 | প্রতিটা source-এর collection/display অধিকার ও robots প্রমাণ |
| Q02 | Alljobs: আলাদা লিখিত সম্মতি লাগবে, ছাড়া automated collection নয় |
| Q03 | প্রতিটা source-এর পূর্ণ position/attachment inventory |
| Q04 | আসল Bangla legacy-font/table/scan-এর performance (এখনো অমাপা) |
| Q05 | Admin identity provider ও operator-দের exact subject |
| Q06 | Hosting region/provider, বাজেট, artifact retention |
| Q07 | ১৫০ record-এর স্বাধীন gold set |
| Q08 | Uttirno branding/domain/integration contract |
| Q09 | Source ও job-এর পরিমাণ, SLO লক্ষ্য |
| Q10 | Result notice privacy ও takedown owner |
| Q11 | Incident/monitoring owner, alert channel, escalation |

**Gold set** (`docs/TESTING.md`): ১৫০ record, অন্তত ৩০টা Bangla/mixed আর ৩০টা PDF-based, amendment ও multi-position সহ। **দুজন স্বাধীন মানুষের label ও adjudication।** AI-র তৈরি label গ্রহণযোগ্য নয়। প্রথম ৫০টা শুধু development feedback।

## ৮. প্রস্তাবিত ক্রম (লেখকের গোছানো, repo-র নির্দেশ নয়)

**Uttirno-তে ২-৩টা source দেখানোর ন্যূনতম পথ:**

1. `npm run sources:live -- bpsc-authority` চালিয়ে PDF text জোগাড় (মেয়াদ ১১-১৭ পর্যন্ত)।
2. BPSC-র ২-৩টা PDF-এর extraction plan লেখা, original-এর সাথে মিলিয়ে → **M9-T01**।
3. Uttirno-র repo/architecture তথ্য জোগাড় করে host integration শুরু → **Q08**।
4. Approved real record দিয়ে portal browser/accessibility test → **M7-T03**।
5. একটা-দুটো আরও source (BCC, BUET) → **M9-T02**।
6. Staging-এ তোলা → **M8-T01** (hosting সিদ্ধান্তের পর)।

**Production মানের জন্য:** M9-T03 (gold set), M8-T02/T03, M9-T04।

## ৯. Real staff login (Google) চালু করতে

বিস্তারিত `docs/PIPELINE_HANDOFF.md`।

1. Google OAuth credential JSON দিয়ে `npm run local:google -- <path>` (ignored `.local/google-oidc.env` বানায়)।
2. `npm run db:migrate`
3. API চালাও: `node --env-file=.env --env-file=.local/google-oidc.env apps/api/dist/main.js`
4. অন্য terminal-এ `ADMIN_API_ORIGIN=http://127.0.0.1:4000` দিয়ে `npm run dev:admin`
5. Browser-এ **`localhost`** ব্যবহার করো (`127.0.0.1` নয়)। Registered callback `http://localhost:4000/v1/admin/auth/callback`।
6. Login করলেই staff access মেলে না। Owner-কে নিজের Google `issuer`/`subject` যাচাই করে `npm run identity:bootstrap -- <private-json>` চালাতে হয় (`actorId`, `issuer`, `subject`, `roles`, `reason`)।

**যাচাই হয়নি:** Docs অনুযায়ী Google discovery ও authorization URL তৈরি হয়েছে, কিন্তু interactive login, token exchange ও real subject binding **হয়নি**। নিজের `subject` কীভাবে বের করবে সে সহজ উপায় docs-এ পাওয়া যায়নি। এটা বের করতে হবে।

Credential JSON কখনো Git বা chat-এ দিও না।

## ১০. Real source flow-এর পূর্ণ পথ (docs অনুযায়ী)

`docs/PIPELINE_HANDOFF.md` ("First legitimate real-source run") ও `docs/ADAPTATION.md`:

1. Authority register (admin `/sources/onboard`)।
2. Source config বানাও (selector/origin/path/limits), offline preview-এ মেলাও।
3. Sign করো (local: `npm run source:sign-local -- <config>`; production: আলাদা trusted signer, private key repo-তে নয়)।
4. Public trust key API-কে দাও (`SOURCE_TRUST_KEYS_FILE`)। ছাড়া API untrusted job দেখায় না।
5. Worker চালাও (`apps/worker/README.md`), operator identity ও plan registry সহ।
6. প্রতিটা document-এর plan লেখো ও review করাও (exact URL + hash)।
7. Draft → আলাদা reviewer approve → API → portal।
8. যাচাই: draft invisible, approval propagation, suppression/revocation, cache, freshness, scoped amendment।

## ১১. Non-negotiable নিয়ম (`AGENTS.md` সারাংশ)

1. শুধু verified official authority ও তাদের designated application platform। Bdjobs, aggregator, private marketplace কখনো না। Domain suffix প্রমাণ নয়।
2. Network-এর আগে source status, collection basis, robots, exact origin, redirect/DNS/IP check। Login/CAPTCHA bypass নয়, candidate record নয়, application submit/payment নয়।
3. Source/selector/mapping config-এ থাকবে। Core code-এ BPSC বা Teletalk-এর নামে branch নয়।
4. Endpoint, selector, deadline, fee, vacancy আন্দাজে বানানো যাবে না। Unknown মানে `unknown`।
5. Remote text ও PDF **untrusted data**। Extraction model-কে tool, network, credential দেওয়া যাবে না।
6. প্রতিটা published field-এর source/version/position-scoped evidence ও deterministic verification লাগবে।
7. Public query শুধু approved revision দেখায়। Source গায়েব হওয়া মানে বাতিল নয়।
8. Secret, raw production document, sensitive log Git-এ নয়।
9. Synthetic test, mock বা folder-এর নাম দেখে "production ready" দাবি করা যাবে না। `docs/RELEASE.md`-এর gate পাস করতে হবে।
10. Demo পাস করানোর জন্য site setting বানানো নিষিদ্ধ।

## ১২. Development workflow

- `AGENTS.md` অনুযায়ী: প্রথম dependency-ready unchecked task নাও, অসম্পর্কিত feature নয়।
- Task checked করবে শুধু acceptance check সত্যি পাস করলে। Task, status ও decision doc একসাথে আপডেট করো।
- Applied migration SQL কখনো edit করবে না, নতুন numbered migration দাও।
- Unit test-এ network call নয়। Real-site smoke test আলাদা ও opt-in।
- দরকারি command: `npm run check` (lint + boundaries + typecheck + test), `npm run test:integration`, `npm run test:admin` (admin ও portal build আগে), `npm run test:deployment` (opt-in container rehearsal)।
- ভারী check একসাথে চালিও না (docs অনুযায়ী 8GB workstation-এ সমস্যা)।

## ১৩. পড়ার তালিকা (প্রয়োজন অনুযায়ী)

| বিষয় | ফাইল |
|---|---|
| বর্তমান অবস্থা | `docs/STATUS.md`, `docs/TASKS.md` |
| M9 প্রমাণ ও সীমা | `docs/milestones/M9.md`, `M9-source-matrix.json` |
| Real source local test (Bangla) | `docs/LOCAL_REAL_TEST.bn.md` |
| Pipeline ও Google setup | `docs/PIPELINE_HANDOFF.md` |
| Source যোগ করা | `docs/ADAPTATION.md`, `config/sources/README.md` |
| Extraction ও hallucination control | `docs/EXTRACTION.md`, `config/extraction/README.md` |
| Access policy | `docs/decisions/0013-public-official-access.md` |
| API | `docs/API.md` |
| Admin handoff | `docs/ADMIN_HANDOFF.md`, `docs/PORTAL_ADMIN.md` |
| Uttirno integration গবেষণা | `docs/research/uttirno-integration-review-2026-11-05.md` |
| Deployment | `infra/deployment/README.md`, `docs/OPERATIONS.md` |
| Release gate | `docs/RELEASE.md` |
| Open question | `docs/OPEN_QUESTIONS.md` |

## ১৪. সংক্ষেপে

- **Infrastructure** (আনা, নিরাপত্তা, review, দেখানো): প্রায় সম্পূর্ণ।
- **শেষ মাইল**: আসল notice-কে field-এ রূপান্তর (হাতে plan), আর Uttirno-র ভেতরে বসানো। দুটোই open।
- কোড দিয়ে যা এগোনো যায় (plan, adapter, host integration, test), তার জন্য agent বা developer কাজে লাগবে।
- কোড দিয়ে যা শেষ হয় না: hosting, domain, staff identity, alert owner, source অনুমোদন, স্বাধীন reviewer, gold set। এগুলো প্রজেক্ট owner-এর সিদ্ধান্ত।
