# Module deepening

Concentrate ownership of the review lifecycle, progress, report interpretation, provider behavior and wizard transitions inside their modules, so callers need less knowledge.

Sources, both dated 2026-11-01:

- [Codebase design assessment](../../reports/2026-11-01-codebase-assessment.md): all five priorities, problems and validation.
- [Architecture review](../../reports/2026-11-01-architecture-review.html): diagrams, deletion tests and test surfaces for priorities 1-3.

| Ticket | Assessment priority | Status |
| --- | --- | --- |
| [01](01-review-run-settles-agents-before-cleanup.md) | 1. Review lifecycle | `ready-for-agent` |
| [02](02-review-run-owns-progress.md) | 2. Progress ownership | `ready-for-agent` |
| [03](03-shared-report-interpretation.md) | 4. Report interpretation | `ready-for-agent` |
| [04](04-provider-adapters-own-execution.md) | 3. Provider adapter locality | `ready-for-agent` |
| [05](05-wizard-transition-function.md) | 5. Wizard transitions | `needs-triage` |

Out of scope: `demo/bug-farm/`.
