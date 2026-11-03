# CI foundation

ci.yml runs clean lockfile install, lint/boundary/type/unit/prototype checks, all application builds, isolated services, real integration tests and built HTTP smoke. Actions are pinned to release commit hashes. Read-only repository permission; no production secrets or deployment.

A checked-in workflow is not a claim that GitHub already ran it. Release/provisioning/security additions belong to M8.
