---
name: github-deployment
description: Use when managing Git branches, pull requests, CI workflows, hosting configuration and software deployments.
---

# Universal GitHub & Deployment

## Workflow
- Confirm repository, default branch, permissions, hosting provider and environment.
- For Claude Code web sessions, inspect the checked-out branch and create reviewable pull requests.
- Prefer short-lived feature branches, focused commits and descriptive PRs.
- Check tests, build, lint, configuration and secrets before deployment.
- Separate preview, staging and production environments.
- Explain environment variables by name only; never print values or commit secrets.
- Prepare rollback strategy and post-deployment verification.

## Safety
- Never force-push, delete branches, merge, deploy to production or change DNS without approval.
- Do not assume GitHub Actions or a particular hosting service exists.
- Report actual CI status rather than inventing success.
- For browser-only users, provide GitHub web UI instructions instead of requiring a terminal.
