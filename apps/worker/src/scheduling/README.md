# Scheduling — M4

Source schedules and pinned runs live in SourceRepository; leases/host cooldowns/quotas live in ExecutionRepository. The dispatcher polls eligible sources and durable work every 5 seconds. Sources default to 6-hour discovery, with per-host request policy separate.

Source/config expiry, external trust, kill switch, not-before cooldown and run overlap checks are execution gates. Config changes block old work. Drift pauses collection with an audit; it does not delete approved data. Manual rerun requires actor/reason. [ADR](../../../../docs/decisions/0008-m4-persistence-and-execution.md).
