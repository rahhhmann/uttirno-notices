# Config-driven adapters

HTML supports scoped table/card/list items, title/link/field mappings, attachment/sibling links and next-link pagination. JSON supports bounded JSON pointers to items/title/URLs/attachments/next. No eval, generated JavaScript or guessed API routes.

Mappings retain original and normalized strings and locators. They are candidates, not verified facts. Cardinality/layout failures are explicit; unapproved URLs are quarantined by hash without leaking credentials. New titles are arbitrary data.

Real observed BPSC fragment regressions and synthetic different-layout tests are present. PDF/OCR and semantic qualification extraction belong to M3.

Optional `embeddedHtml` config decodes one selected base64 attribute (at most 1 MiB decoded, strict canonical base64 and valid UTF-8) before ordinary selectors. Remote content remains inert; scripts are never executed and all resulting URLs still pass the same scope/quarantine checks. The current encoded real fragment has its own URL/time/hash metadata and three-link regression.

`attachmentAttributes` optionally specifies an ordered list of inert HTML attributes, for example observed `pdf-link` plus `href`. The first present value is scope-checked; an unsafe primary value is quarantined rather than falling back to a safe-looking second value. No JavaScript/onclick evaluation. `exact:true` on a source path rule permits query-routed root notice URLs without approving unrelated descendants.
