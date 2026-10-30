# Verifying code review findings

- Confirm a correctness finding by following the real call sites and data, not the reviewer's description.
- Rank by impact on behaviour: broken logic above style.
- Downgrade pure style or preference to low unless it breaks a convention the repository follows.
- Missing tests are a finding when changed behaviour has no coverage at all.
