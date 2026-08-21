# IA-2E First-Run Policy

The pull request that introduces this file is the first authorized execution point for the sealed IA-2E holdout.

- No matcher changes are present relative to sealed matcher SHA `2c4dbdf69ad8c646e832a924292ac4c0a2fdc7c4`.
- CI performance output is observational and must not be tuned on this branch.
- Low performance does not fail the runner; integrity violations do.
- After the first result is observed, any matcher tuning requires a future holdout before making a new independent-validation claim.
