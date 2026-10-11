# tuna-os/.github — Organization Configuration Defaults

This repository defines the shared infrastructure, workflows, actions, and policies for all TunaOS projects. Nothing here builds a product; everything here applies to other repositories through shared configuration.

## Repository Purpose

`tuna-os/.github` is the single source of truth for:
- GitHub Actions workflows and composite actions consumed by other repos
- Issue/PR templates and discussion formats shared across the org
- Code of Conduct and contribution guidelines
- Project templates for new repositories
- CI/CD security policies and compliance checks

## Blast Radius: How Changes Propagate

| Path | Scope | Propagation | Notes |
|---|---|---|---|
| `.github/ISSUE_TEMPLATE/`, `PULL_REQUEST_TEMPLATE.md`, `DISCUSSION_TEMPLATE/` | Issue/PR/discussion templates | Every org repo without its own copy | Immediate; no merge needed in that repo |
| `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md` | Org-wide contributor docs | Every org repo without its own copy | Immediate; no merge needed in that repo |
| `profile/README.md` | Public landing page | The TunaOS GitHub organization profile | Published on https://github.com/tuna-os |
| `.github/workflows/*.yml` with `on: workflow_call` | Reusable workflows | Repos that `uses:` them | **Callers pin `@main`, so live immediately on merge** |
| `.github/actions/*` | Composite actions | Repos that `uses:` them | **Callers pin `@main`, so live immediately on merge** |
| `project-starter/` | Template for new repos | Copied into new repositories at creation | Not live in this repo; used as a blueprint |

**Critical note**: `publish-flatpak.yml`'s inputs and each action's `inputs:` block are a public API. Renaming an input, changing a default value, or altering semantics breaks callers silently at their next run.

## Directory Structure

### `.github/workflows/`

GitHub Actions workflows provided to the org. Most are reusable (`on: workflow_call`) for use in downstream repos.

Key workflows:
- **`publish-flatpak.yml`** — Reusable workflow for publishing apps to Flatpak (GHCR index and remote)
- **`reusable-ci-contract.yml`** — CI contract verification (green criteria enforcement)
- **`reusable-fork-safety.yml`** — Fork safety and upstream tracking checks
- **`reusable-lint.yml`** — Standard linting pipeline
- **`workflow-permissions-check.yml`** — Enforces top-level `permissions:` block on all workflows (policy: #155)
- **`renovate-policy-check.yml`** — Validates Renovate automerge policy (major updates require human review)
- **`flatpak-tooling-drift-check.yml`** — Guards against drift of `update-index.py` copies across repos

See [`AGENTS.md`](AGENTS.md) for architecture details and load-bearing design decisions.

### `.github/actions/`

Composite GitHub Actions used by downstream repos.

- **`update-flatpak-index/`** — Canonical Flatpak index update action (replaces byte-copied scripts)

### `project-starter/`

Template structure for new repositories. Contains boilerplate CI workflows, scripts, and configuration:
- `.github/workflows/` — Starter workflows with correct structure
- `scripts/` — Byte-identical copies of shared validation scripts (check-renovate-automerge-policy.py, check-workflow-permissions.py)
- `Justfile` — Standard build/test/lint recipe names
- `renovate.json` — Pre-configured with org policy
- `README.md`, `ROADMAP.md`, `docs/ADOPTING.md` — Documentation templates

When cloning this template into a new repo, scripts must be kept in sync manually.

### `scripts/`

Shared validation scripts run by CI workflows:

- **`check-renovate-automerge-policy.py`** — Fails if a repo's `renovate.json` would automerge major updates (policy: #12)
- **`check-workflow-permissions.py`** — Verifies every workflow declares a top-level `permissions:` block (policy: #155)
- **`test-renovate-automerge-policy.py`**, **`test_check_workflow_permissions.py`** — Unit tests for the validators

These scripts are dependency-free and run on standard GitHub runners.

### `profile/`

Organization profile settings:
- `README.md` — Displayed on the TunaOS GitHub org landing page

### `docs/`

Reference documentation:
- `OBSERVABILITY.md` — Telemetry stack guidance and best practices

## Getting Started

### Understanding the Org Architecture

Start with [`ROADMAP-INDEX.md`](ROADMAP-INDEX.md) to see the complete active repository inventory, then [`CONTRIBUTING.md`](CONTRIBUTING.md) for contributor expectations.

### Adding a New Org-Wide Workflow

1. Create your workflow in `.github/workflows/<name>.yml` with:
   - `on: workflow_call` if it's meant to be reused
   - Explicit `permissions:` block (top-level, principle of least privilege)
   - Clear documentation in comments
2. If it uses inputs, document the purpose and contract of each
3. **Do not interpolate inputs directly into shell code** — route them through `env:` instead (see AGENTS.md for load-bearing details)
4. Test it locally against the workflows-check and any consuming repos
5. Open a PR; maintainers will merge

### Testing Changes Before Merge

Since workflows and actions are live on merge (callers pin `@main`), always:
1. Create a test branch and push to it
2. Have a test repo reference your branch: `uses: tuna-os/.github/.../action@<your-branch>`
3. Verify the test run succeeds
4. Update the branch to `main` in the test repo and verify once more before merging here

### Understanding Propagation Timing

- **Org templates and docs**: Changes merge and appear in all downstream repos immediately (no per-repo merge needed)
- **Reusable workflows and actions**: Changes merge and are live immediately for callers pinning `@main`
- **Project starter**: Changes are copied into new repos at creation time; existing repos do not auto-update

### Common Policies

**Workflow Permissions** (`.github/workflows/workflow-permissions-check.yml`):
```yaml
permissions:
  contents: read
```
Every workflow must declare this block. Otherwise it inherits the repo's default token scope, which is almost always too broad.

**Renovate Automerge** (`renovate.json`):
- Minor, patch, pin, and digest updates may automerge once CI is green
- **Major updates always require human review** before merging (checked by `check-renovate-automerge-policy.py`)

**Repository Defaults** (`ROADMAP-INDEX.md`):
Default branches vary across repos (`main`, `master`, `dev`, `ptyxis-port`, `v4`). Never assume `main`.

## Related Documents

- [`AGENTS.md`](AGENTS.md) — Architecture decisions, design concerns, and workflow internals
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — Org-wide contribution guidelines
- [`CODE_OF_CONDUCT.md`](CODE_OF_CONDUCT.md) — Community standards
- [`SECURITY.md`](SECURITY.md) — Vulnerability reporting and security scope
- [`ROADMAP-INDEX.md`](ROADMAP-INDEX.md) — Complete inventory of active repos and their roadmap coverage

## See Also

- [`tuna-os/docs`](https://github.com/tuna-os/docs) — Architecture and build-pipeline reference documentation
- TunaOS GitHub org: https://github.com/tuna-os
