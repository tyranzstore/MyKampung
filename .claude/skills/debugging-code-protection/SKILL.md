name: debugging-code-protection
description: Use when diagnosing bugs, reviewing changes, refactoring existing code or protecting functionality from regressions.
---

# Universal Debugging & Code Protection

## Workflow
1. Reproduce or precisely characterize the issue; collect errors and expected behavior.
2. Inspect relevant files, tests, recent changes and dependency versions.
3. Identify likely root cause and distinguish confirmed evidence from hypotheses.
4. Propose minimal, reversible fix; request approval for destructive operations.
5. Add regression tests where feasible, run available tests and inspect diff.
6. Report what is verified versus what still needs manual testing.

## Guardrails
- Preserve public interfaces, persisted data, assets and existing functionality unless approved.
- Do not rewrite whole modules for localized fixes or edit unrelated files.
- Never claim tests passed unless executed.
- Work on a branch for meaningful changes; never force-push or auto-merge.
- Do not delete data, reset databases or alter production without explicit approval.
