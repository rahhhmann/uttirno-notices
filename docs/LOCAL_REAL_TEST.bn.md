# Local real-source test

এটি আসল official website থেকে GET/PDF/text/OCR test। এটি synthetic demo নয়। বর্তমানে structured position/field mapping ও independent publication approval সম্পূর্ণ নয়; তাই সফল report মানেই পুরো project বা production release complete নয়।

## নিজের computer-এ চালানো

PowerShell-এ repository root থেকে:

```powershell
Set-Location E:/uttirno-notices
npm run sources:live
```

আগে dependencies install না থাকলে `npm ci` লাগবে। Node/npm এবং Poppler/Tesseract `ben+eng` requirements [development](DEVELOPMENT.md)-এ আছে। এই private acquisition command-এর জন্য Google login, API key, Docker বা database প্রয়োজন নেই। সব sources sequentially চলে; root `.env` বা credentials print করে না।

শুধু একটি source test:

```powershell
npm run sources:live -- bpsc-noncadre
```

Command শেষে `Review matrix:`-এর পরে যে HTML path দেখাবে সেটি browser-এ খোলো। প্রতিটি row থেকে নিজস্ব original/text report খোলা যাবে। Expected status `needs_review`; `incomplete` বা error হলে সেটি successful extraction নয়। Report-এ PDF, page count ও OCR flags মিলিয়ে দেখো; সব originals ও extracted text private/ignored থাকবে।

## Website link কোথায় থাকবে

[Source registry](../config/live-sources.v1.json)-এ source ID ও তার config file নির্বাচন করা হয়। সংশ্লিষ্ট [source configs](../config/sources/README.md)-এর `seeds`-এ actual notice-page URL থাকে। একই config-এর `origins`, path/query rules, `adapter`, samples ও dated access assessment ঠিক করতে হয়। URL পাল্টালেই অন্য website কাজ করবে—এমন নয়। Source config বদলালে signature বদলায়; command বর্তমান reviewed config-কে আলাদাভাবে local-sign করে। Expired assessment নিজে renew করে না।

বর্তমান sources: BPSC authority non-cadre slice, BPSC Teletalk non-cadre slice, BCC-এর নিজস্ব notice 153, Bangladesh Bank মূল notice board-এর দুই নিজস্ব recruitment notice/TOR এবং BUET-এর দুই registrar recruitment announcement। এগুলো accepted sample scopes; সব historical notice, সব employer বা সব university coverage নয়।

## Flow

Versioned source config → explicit local signature → robots/origin/DNS/TLS/request-budget checks → notice discovery → private PDF capture/hash → text/OCR → private review report.

Collected text → correct position/field mapping → authenticated independent review → approved API projection → portal: এই পরের অংশটি actual accepted source records দিয়ে এখনও সম্পূর্ণ হয়নি। `npm run local:demo` দিয়ে staff/portal approval flow দেখা যায়, কিন্তু সেটি fictional data; এটিকে real-source end-to-end acceptance বলা যাবে না। [Pipeline handover](PIPELINE_HANDOFF.md), [M9 evidence](milestones/M9.md)।

Teletalk-এর প্রথম default-CA attempt-এ `TRANSPORT_FAILED` হয়েছিল; পরবর্তী system-CA-enabled run সফল। Commands Node-এর `--use-system-ca` ব্যবহার করে; `rejectUnauthorized=true`, DNS/IP/robots gates বজায় থাকে। Exact original transport cause নিশ্চিত করা হয়নি। TLS verification কখনও বন্ধ কোরো না।

Bangladesh Bank e-Recruitment endpoint গবেষণায় request reject করেছে; সেটি bypass করা হয়নি। মূল bank authority notice-board test-এর success দিয়ে e-Recruitment-ও কাজ করে দাবি করা যাবে না।

Local retention সাত দিন; config expiry-র পরে reassessment দরকার। Originals/reports/keys Git বা public hosting-এ দিও না। বর্তমানে local files-এর automatic purge service নেই।
