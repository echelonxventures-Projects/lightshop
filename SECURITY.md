# Security Policy

## Reporting a vulnerability

**Do not open a public issue.** Report vulnerabilities privately through GitHub's
[private vulnerability reporting](https://github.com/echelonxventures-Projects/lightshop/security/advisories/new).

Please include affected component(s), version/commit, reproduction steps and impact.

| Stage | Target |
|---|---|
| Acknowledgement | 2 business days |
| Triage and severity (CVSS v4) | 5 business days |
| Fix for critical/high | 30 days, coordinated disclosure afterwards |

## Supported versions

Only the latest `main` and the most recent release are supported during Phase 0–1.

## Security baseline

Services follow [ADR-0009](docs/adr/0009-service-security-baseline.md): verified tokens only,
tenant headers trusted only from the gateway, query-cost limits, secure defaults and fail-fast
production configuration. Dependency updates are automated by Renovate (see `renovate.json`).
