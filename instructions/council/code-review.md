# Verifying code review findings

- Verify the claimed failure against actual callers, guards and relevant tests.
- Verify a standards finding against the cited rule and a spec finding against the quoted requirement; a documented repository standard overrides a reviewer's heuristic.
- Keep each finding's axis as its heading's area, so a clean axis cannot mask a failing one.
- Keep smells outside the confirmed findings, under a level-2 `Smells` heading after them: merge duplicates, drop smells the code or a documented repository standard contradicts, and keep each as a judgement call with its attribution.
