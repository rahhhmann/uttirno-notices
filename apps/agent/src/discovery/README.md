# Bounded discovery

Configurable seed/list/detail traversal follows next and sibling links, inventories attachments and records acquisition metadata/errors/quarantine/truncation. It uses SourceClient for all acquisitions. A complete discovery run means the configured bounded page graph was traversed without reported gaps; it does not mean every job fact or PDF was extracted or approved.

Loops, count drift, unapproved destinations and exhausted budgets cannot become a successful empty import. M3 archives/extracts documents; M4 canonicalizes/deduplicates candidates.
