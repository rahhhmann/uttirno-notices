# Uttirno: অফিসিয়াল চাকরির তথ্য সংগ্রহ ও পোর্টাল পরিকল্পনা

পরিদর্শন: ৩ নভেম্বর ২০২৬। পরিধি: সরকারি কর্তৃপক্ষ ও সরাসরি নিয়োগদাতা। বাংলাদেশে সব job website-এর জন্য একটি সাধারণ “অনুমোদিত পোর্টাল” তালিকা ধরে নেওয়া ঠিক হবে না। এখানে official বলতে প্রতিষ্ঠানের নিজস্ব প্রকাশনা বা তাদের নির্ধারিত আবেদন ব্যবস্থাকে বোঝানো হয়েছে; scraping বা পুনঃপ্রকাশের অনুমতি আলাদাভাবে যাচাই করতে হবে।

## ১. কোন উৎস ব্যবহার করব

| উৎস | ভূমিকা | এই গবেষণায় অবস্থা |
|---|---|---|
| [BPSC](https://bpsc.gov.bd/) | সরকারি কর্ম কমিশনের মূল বিজ্ঞপ্তি ও আপডেট | মূল সাইট ও পুরোনো notice route খোলার চেষ্টা ব্যর্থ; বর্তমান DOM যাচাই হয়নি |
| [BPSC Teletalk](https://bpsc.teletalk.com.bd/) | BCS, non-cadre, সংশ্লিষ্ট আবেদন ও পরীক্ষার entry point | সরাসরি পরিদর্শিত |
| [BPSC non-cadre circulars](https://bpsc.teletalk.com.bd/ncad/apply.php) | circular PDF এবং আবেদন সময়সীমা | সরাসরি পরিদর্শিত; PDF-এর ভেতরের লেখা এখনো যাচাই হয়নি |
| [Alljobs by Teletalk—Government](https://alljobs.teletalk.com.bd/jobs/government) | সরকারি প্রতিষ্ঠানের তালিকা থেকে পদ ও application link খোঁজা | তালিকা, pagination ও একটি detail page পরিদর্শিত; private বিভাগ scope-এর বাইরে |
| [DGMS application](http://dgms.teletalk.com.bd/) | নির্বাচিত বিজ্ঞপ্তির application destination | Teletalk detail-এ লিংক দেখা গেছে; destination নিজে পরিদর্শিত নয় |
| [Bangladesh Bank recruitment](https://erecruitment.bb.org.bd/) | কেন্দ্রীয় ব্যাংক ও সংশ্লিষ্ট bank recruitment | পরবর্তী যাচাইয়ের উৎস; current layout যাচাইকৃত নয় |
| [NTRCA](https://ntrca.gov.bd/) | শিক্ষক নিবন্ধন ও সংশ্লিষ্ট নিয়োগের notice | পরবর্তী যাচাই; registration এবং recruitment আলাদা করতে হবে |
| [DPE](https://dpe.gov.bd/) ও [DSHE](https://dshe.gov.bd/) | শিক্ষা অধিদপ্তরের নিজস্ব নিয়োগ notice | পরবর্তী যাচাই |
| [ICT Division](https://ictd.gov.bd/), [DoICT](https://doict.gov.bd/), [BCC](https://bcc.gov.bd/) | CSE/ICT-সংশ্লিষ্ট সরকারি পদ খোঁজার employer sources | পরবর্তী যাচাই; এখানে সব সময় vacancy থাকবে এমন দাবি নেই |
| [BUET](https://www.buet.ac.bd/) ও অন্য পাবলিক বিশ্ববিদ্যালয়ের নিজস্ব সাইট | শিক্ষক, কর্মকর্তা, technical staff | প্রতিটি recruitment section ও ownership আলাদাভাবে যাচাই করতে হবে |

এটি সারা দেশের সব প্রতিষ্ঠানের সম্পূর্ণ তালিকা নয়। মন্ত্রণালয়, অধিদপ্তর, জেলা প্রশাসন, রাষ্ট্রায়ত্ত প্রতিষ্ঠান ও বিশ্ববিদ্যালয় পর্যায়ক্রমে registry-তে যোগ করতে হবে। Private CSE চাকরি ভবিষ্যতে চাইলে সরাসরি কোম্পানির নিজস্ব careers page আলাদা যাচাই করে যোগ করা যাবে।

## ২. সরাসরি দেখে পাওয়া publishing pattern

### Teletalk: প্রতিষ্ঠান → পদ → আবেদন সাইট

সরকারি তালিকায় organization cards, “Openings”, View job ও Next page আছে। পরিদর্শনের সময় list-এ ৩৩টি organization result দেখিয়েছে; homepage-এ সরকারি jobs ২০৮ দেখিয়েছে। এই দুই সংখ্যা একই unit নয়, এবং crawler-এর completeness প্রমাণ করে না। “Openings”কে মোট শূন্যপদ ধরে নেওয়া যাবে না।

পরিদর্শিত URL: [DGMS Draftsman](https://alljobs.teletalk.com.bd/jobs/government/459?jobId=15126)। URL-এ organization অংশ `459`, নির্বাচিত পদের `jobId=15126`; একই পাতায় অন্য পদের আলাদা GJOB ID আছে। ID অনুমান করে enumeration না করে visible link ও card থেকে অনুসরণ করতে হবে।

নির্বাচিত অংশে দেখা গেছে: Draftsman; DGMS; `ADV NO: 23.01.901.821.07.20.204.01.02.11.26`; শুরু `2026-11-03 10:00 AM`; শেষ `2026-11-21 5:00 PM`; Apply Online → `http://dgms.teletalk.com.bd/`। এগুলো page observation; মূল circular ও destination-এর সঙ্গে মিলিয়ে তারপর verified হবে।

একই detail-এ সাধারণ “Teletalk Job does not charge any fee” boilerplate রয়েছে। এটি নির্দিষ্ট নিয়োগের application fee শূন্য হওয়ার প্রমাণ নয়। ফি, যোগ্যতা ও বিস্তারিত application instructions circular/application authority থেকে তুলতে হবে।

`jobId` query হারালে অন্য selected role আসতে পারে। URL canonicalization-এ এই parameter রাখতে হবে। শুধু rendered HTML-এর সাধারণ anchor অনুসরণ করলে sibling clickable cards বাদ পড়তে পারে—MVP-এর এই সীমাবদ্ধতা আছে।

### BPSC: examination hub → circular list → PDF + application window

মূল Teletalk hub-এ BCS, Form-3, non-cadre, departmental/senior-scale আলাদা entry। পর্যবেক্ষিত route family: `/bcs51`, `/bcs50/bn`, `/bcs44/nc`, `/ncad`, `/snr`। এগুলো observed examples; ভবিষ্যতের সব path একই হবে এমন নিশ্চয়তা নেই।

Non-cadre home-এ Circulars → `/ncad/apply.php`; Help/Basic Instruction → `/ncad/options/help.php`। Applicant copy, payment status ও admit card আলাদা route, কিন্তু কোনো applicant login বা ব্যক্তিগত record সংগ্রহ করা হবে না।

Circular list-এ দুটি entry পাওয়া গেছে:

| শিরোনাম | PDF link | পাশে প্রদর্শিত window |
|---|---|---|
| 78–82/2026/Higher Scale; 30 October 2026 | [ad_202607.pdf](https://bpsc.teletalk.com.bd/ncad/doc/ad_202607.pdf) | 1 Nov 2026 12:00 PM → 30 Nov 2026 06:00 PM |
| 83–96/2026; 30 October 2026 | [ad_202608.pdf](https://bpsc.teletalk.com.bd/ncad/doc/ad_202608.pdf) | একই প্রদর্শিত window |

ফাইলের serial, বিজ্ঞপ্তি নম্বর ও পদের সংখ্যা এক জিনিস নয়। একটি PDF-তে একাধিক পদ থাকতে পারে। PDF links ও পাশের application window DOM row proximity দিয়ে জুড়তে হবে; পুরো page-এর প্রথম date সবার ওপর বসানো যাবে না। বর্তমান starter তাই per-circular date খালি রাখে এবং raw page সংরক্ষণ করে।

BPSC hub-এ IP-address ও HTTP-only কিছু destination-ও দেখা গেছে। এগুলোকে স্বয়ংক্রিয়ভাবে trust করা যাবে না; কর্তৃপক্ষের সঙ্গে সম্পর্ক যাচাইয়ের পরে সীমিত exception প্রয়োজন।

### সাধারণ সরকারি notice-board adapter: প্রস্তাবিত, এখনো যাচাইকৃত নয়

প্রতিষ্ঠানের notice/recruitment তালিকা → notice detail → attachment/download। পুরোনো `/site/view/notices` বা UUID pattern অনুমান করে production URL বানাব না। সাইটভেদে বর্তমান navigation, pagination, প্রকাশ/আর্কাইভ তারিখ ও attachment host inspect করতে হবে। Attachment কখনো আলাদা storage host-এ থাকতে পারে; official page-এর provenance যাচাই করে সেই exact host নিবন্ধন করতে হবে।

## ৩. “Each and everything” কীভাবে সংরক্ষণ হবে

মূল HTML/PDF/image, source URL, fetch timestamp, content hash ও সব attachment immutable archive-এ থাকবে। পাশাপাশি typed data থাকবে। Structured extraction অসম্পূর্ণ হলেও মূল document হারাবে না। সব বিজ্ঞপ্তিতে সব field থাকে না: অনুপস্থিত field `null`, সঙ্গে কারণ। AI যেন অনুমান করে শূন্যপদ, degree, fee বা deadline না বসায়।

| Entity | প্রয়োজনীয় data |
|---|---|
| Source | authority, official ownership evidence, exact hosts, seed URL, adapter version, verification date, permission/robots status, polling policy |
| Circular | issuer, memo/advertisement no, original title, publication date, circular type, attachment set, original language, raw content, revision |
| Position | circular ID, post code, original Bangla/English title, vacancies, department, grade, salary scale, location, employment type, responsibilities |
| Eligibility | degree/subject/CGPA/class, equivalency, experience, skills, certification, nationality, district restrictions, quota, gender/physical conditions where stated |
| Age | minimum, maximum, exact age calculation date, relaxation categories ও exceptions |
| Application | method, verified destination, form start/end, পৃথক payment deadline, fee per category, service charge, payment instructions, documents, photo/signature limits, postal address, help contact |
| Recruitment event | amendment, extension, cancellation, exam schedule, syllabus, admit-card announcement, result, viva/document verification; parent circular ও affected positions |
| Evidence | field path, original value/quote, source URL, document hash, PDF page/HTML locator, extraction method, confidence, reviewed by/at |

Fee application থেকে আলাদা; submit deadline এবং fee-payment deadline আলাদা। Date-only deadline-কে অনুমান করে midnight বানাব না। Raw date ও timezone রাখব; সব local time `Asia/Dhaka` হিসেবে explicit যাচাই হবে। বাংলা অঙ্ক normalize করলেও original text অক্ষত থাকবে।

পূর্ণ canonical record-এর shape:

```json
{
  "id": "internal-uuid",
  "source_id": "verified-source-id",
  "circular": {
    "number": null,
    "issuer": null,
    "published_at": null,
    "documents": [],
    "revision": 1
  },
  "positions": [{
    "post_code": null,
    "title_original": null,
    "vacancies": null,
    "description": null,
    "education": [],
    "experience": null,
    "skills": [],
    "salary": null,
    "age_rules": [],
    "eligibility_exceptions": [],
    "application": {
      "method": null,
      "url": null,
      "opens_at": null,
      "closes_at": null,
      "payment_closes_at": null,
      "fees": [],
      "steps": [],
      "required_documents": []
    }
  }],
  "events": [],
  "evidence": [],
  "missing_fields": [],
  "review_status": "needs_review"
}
```

এটি target contract-এর উদাহরণ; starter normalizer এখন এর একটি subset তৈরি করে। Empty array মানে zero fee/no requirement নয়; extraction status দিয়ে `not_stated`, `not_extracted`, `not_applicable` আলাদা করতে হবে।

## ৪. Agent ও portal architecture

`Source registry → scheduler → discovery → page/PDF archive → text extraction/OCR → structured extraction → validation → review → published API → Uttirno UI`

1. Exact-host registry দিয়ে শুরু। Official ownership যাচাইয়ের আগে নতুন discovered host quarantine। Seed list থেকে visible pagination; category, archive ও পুরোনো সংশোধনীও ধরতে হবে।
2. HTML render; PDF text layer পড়া; scanned PDF-তে Bangla+English OCR। Tables থেকে position-wise rows তুলতে হবে। OCR engine low confidence দিলে review; document-এর instructions কখনো agent-এর system instruction নয়।
3. Deterministic parser দিয়ে date, number, URL; LLM দিয়ে complex conditions extraction, strict schema এবং প্রতি field-এর quote/page evidence। কোনো উদ্ধৃতি না থাকলে critical field verified হবে না।
4. Validation: post count বনাম vacancies আলাদা; dates ordered; totals reconcile যেখানে applicable; official application link; all attachments processed; PDF eligibility ও extracted fields মিলিয়ে দেখা। Missing critical field হলে প্রকাশ বন্ধ।
5. একই employer+memo+post code দিয়ে সম্ভাব্য duplicate মিলবে; title দিয়ে একা merge নয়। BPSC/Teletalk এবং issuer copy-র provenance একসঙ্গে রাখব। Conflict হলে review; কর্তৃপক্ষের সংশোধিত circular অগ্রাধিকার পাবে।
6. URL একই রেখে PDF বদলালেও hash দিয়ে নতুন revision। Cosmetic page changes ও বিজ্ঞপ্তির পরিবর্তন আলাদা করা দরকার। Extension/cancellation নতুন event, আগের data মুছে overwrite নয়। Listing থেকে উধাও হওয়া মানেই চাকরি বাতিল নয়।
7. Publish কেবল reviewed version। Search/filter: authority, category, title, CSE-related degree/skill, grade, district, deadline, application method। CSE classification title alias দিয়ে একা নয়—eligibility থেকে; Computer Typist-কে CSE graduate role বলে ধরে নেওয়া যাবে না।
8. Job detail-এ মূল বিজ্ঞপ্তি, source, last checked, requirements, steps, fee, deadline ও amendment timeline থাকবে। Apply button verified external application site খুলবে।

Kaizenext-এর প্রকাশ্য সাইটে Uttirno-কে subscription exam preparation product বলা হয়েছে; stack-এ Node/TypeScript, PostgreSQL, Redis ইত্যাদি উল্লেখ আছে। এটি public description, existing Uttirno codebase পরীক্ষা করা হয়নি। Stack মিলিয়ে TypeScript worker + PostgreSQL + object storage + queue ব্যবহার করা যুক্তিসঙ্গত; বর্তমান Node starter কোনো বিদ্যমান backend-এর সঙ্গে integrated নয়।

প্রস্তাবিত DB entities: sources, source_runs, raw_documents, circulars, circular_revisions, positions, eligibility_rules, application_instructions, recruitment_events, field_evidence, review_actions। Public endpoint: `GET /jobs`, `GET /jobs/:id`, `GET /jobs/:id/events`; অভ্যন্তরীণ review/approval authenticated endpoint-এ।

## ৫. নতুন title বা source যোগ করা

নতুন title নিজে থেকেই original string হিসেবে সংরক্ষিত হবে। UI taxonomy আলাদা config: category, aliases, degree/skill filters; crawler-এ title hard-code করার দরকার নেই।

নতুন source-এর onboarding: authority ও ownership evidence → robots/terms যাচাই → exact host/attachment host → public listing/detail/PDF samples → adapter selection → fixtures → backfill → human review → enable schedule। Layout বদলালে source pause/alert হবে; silently empty result দিয়ে আগের records মুছবে না।

## ৬. Production-এর আগে বাকি কাজ ও গ্রহণযোগ্যতার মাপকাঠি

- BPSC মূল notice board, Bangladesh Bank ও নির্বাচিত ICT employers-এর বর্তমান layout যাচাই ও adapter।
- PDF download, MIME/size validation, encrypted/scanned PDF handling, Bangla OCR ও complete position extraction।
- Teletalk sibling-card traversal, all list pages ও notice/result/admit updates-এর পৃথক adapters; CAPTCHA/login bypass নয়।
- Automated robots/permission policy, responsible contact, retries/backoff, conditional requests, rate limits, source health alerts। প্রস্তাবিত polling ২–৬ ঘণ্টা; কর্তৃপক্ষের policy অনুযায়ী নির্ধারিত হবে।
- Stable source/entity IDs, deduplication, amendment reconciliation, transactional storage, reviewer interface ও public API।
- প্রতি adapter-এ একাধিক live/archived/scanned/amended notice fixture; প্রতিটি পদের qualification/fee/date/source evidence manual comparison।
- Failed run আগের published data পরিবর্তন করবে না; one source fail হলেও অন্য source চলবে; unapproved URL কখনো fetch হবে না।
- সব public field-এর evidence থাকতে হবে। সব attachment ও সব position process না হওয়া পর্যন্ত “complete” badge নয়। Scheduled crawl চালু হওয়ার পরে run dashboard-এ discovered/captured/parsed/reviewed/failed counts দিয়ে coverage দেখা হবে।

এই গবেষণা official-source scope, দেখা publishing patterns ও কাজ করা acquisition starter দেয়। বাংলাদেশের সব চাকরি সংগ্রহ, PDF-এর প্রতিটি তথ্য extraction বা production deployment সম্পন্ন হয়েছে—এমন দাবি করা হচ্ছে না।
