# tuna-os/.github — org-wide defaults

The org defaults repository. Nothing here builds a product; everything here applies to other repositories. This is the **single source of truth** for:

- Organization-wide issue and PR templates
- Reusable workflows and composite actions
- Contribution guidelines and security policies
- Project starter templates for new repositories

## How changes propagate

There are four different mechanisms with different blast radii:

| Path | Reaches | When |
|---|---|---|
| `.github/ISSUE_TEMPLATE/`, `PULL_REQUEST_TEMPLATE.md`, `DISCUSSION_TEMPLATE/`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md` | Every org repo that does not ship its own copy | Immediately, with no merge in that repo |
| `profile/README.md` | The organisation's public landing page | On next GitHub Pages render |
| `.github/workflows/*.yml` with `on: workflow_call`, and `.github/actions/*` | Every repo that `uses:` them (callers pin `@main`) | At their next workflow run after the merge |
| `project-starter/` | A template **copied** into new repos (not used by `.github` itself) | When a new repo is created from this template |

**There is no version to hold a consumer back and no way to roll back except another commit.** Changes to inputs or defaults in reusable workflows and actions are a public API. Renaming an input, changing what a default means, or removing a feature breaks callers silently at their next run.

## Key files and their purpose

### Shared templates (no copy needed)
- **`.github/ISSUE_TEMPLATE/`** — templates for bug reports, feature requests, and discussions
- **`CONTRIBUTING.md`** — contribution guide that every repo inherits
- **`CODE_OF_CONDUCT.md`** — community standards
- **`SECURITY.md`** — vulnerability disclosure policy

### Reusable workflows
- **`.github/workflows/publish-flatpak.yml`** — builds and publishes Flatpak apps to the remote
- **`.github/workflows/ste-lint.yml`** — checks Markdown prose against Simplified Technical English standards
- **`.github/workflows/workflow-permissions-check.yml`** — enforces top-level `permissions:` blocks on all workflows (least-privilege gate)
- **`.github/workflows/renovate-policy-check.yml`** — prevents automerging of major/minor dependency updates

### Composite actions
- **`.github/actions/publish-flatpak-index`** — wraps `update-flatpak-index` with clone/commit/push retry logic against `tuna-os/docs`
- **`.github/actions/update-flatpak-index`** — updates the Flatpak remote index for a single app+architecture
- **`.github/actions/ste-lint`** — lints Markdown prose

### Scripts and checks
- **`scripts/check-workflow-permissions.py`** — CI gate: verifies all workflows declare top-level `permissions:`
- **`scripts/check-renovate-automerge-policy.py`** — CI gate: verifies `renovate.json` never automerges major/minor updates

**Note:** Both `check-*.py` scripts are **byte-identical copies** in `project-starter/scripts/` and must be kept in sync. Copied scripts in the codebase itself are caught by `flatpak-tooling-drift-check.yml`.

### Documentation
- **`AGENTS.md`** — guide for hive agents working on this repository
- **`ROADMAP-INDEX.md`** — org-wide inventory of which repositories have roadmaps
- **`.claude/skills/hive-contribute/SKILL.md`** — a hive skill for decoupled cobution routing

## Making changes safely

### Adding a new reusable workflow or action

1. **Read the inputs carefully.** Inputs are a public contract — renaming an input breaks all callers.
2. **Test locally first.** Run the workflow or action in a development context.
3. **Update the documentation** — if the inputs or behavior change, document them.
4. **Pin external actions to commit SHAs**, not tags or branches. Tags can be moved; tags cannot pin a specific commit.

### Modifying an existing workflow or action

- If you rename an input, add a `deprecation-notice` step and support both old and new names for one release cycle (so callers have time to migrate).
- If you change what a default does, add a breaking-change notice in the PR and ping all known consumers.
- If you remove an input or action, file an issue linking all repos that use it, so they can migrate on their own schedule.

### Updating shared templates

Changes to issue/PR templates or `CONTRIBUTING.md` apply to every repo that does not ship its own copy. **Test the template in a non-critical repo first.**

## Known issues and limitations

### Flatpak tooling drift
The `flatpak-tooling-drift-check.yml` workflow runs weekly to detect divergence between:
- The canonical `update-index.py` in `.github/actions/update-flatpak-index/`
- Local copies in publishing repos (`dualcut`, `docs`, `Tavern`, etc.)

**Status:** The check has failed on every scheduled run since 2026-08-17. `dualcut` has drifted; other repos have removed their local copies without adopting the shared action. See `AGENTS.md` for details and the migration tracker in `tuna-os/tunaos#1183`.

### Renovate automerge policy not enforced org-wide
The check in `.github/workflows/renovate-policy-check.yml` runs in this repo only. Repos that do not copy `scripts/check-renovate-automerge-policy.py` or wire `renovate-policy` into their `required-checks` list can automerge major/minor updates despite org policy forbidding it. See `tuna-os/.github#12`.

### Default branch inconsistency
Several repos default to branches other than `main`:
- `bootc-installer` → `dev`
- `fisherman` → `dev`
- `changelog-action` → `master`
- `kde-build-meta` → `master`
- `mariner` → `master`
- `blueshell` → `ptyxis-port`
- `hive` → `v4`

Hardcoding `main` in scripts or policies breaks these repos silently. Use `gh api repos/<owner>/<repo> --jq '.default_branch'` to resolve per repo.

## For maintainers

- Keep this file in sync with `AGENTS.md` when the repository structure or blast radius changes.
- Update the `ROADMAP-INDEX.md` quarterly to track which repos have roadmaps.
- Run `scripts/check-renovate-automerge-policy.py renovate.json` before committing changes to `renovate.json`.
- Pin all external actions to commit SHAs using `pin-github-actions.sh` or manually.

## See also

- `AGENTS.md` — guide for agent-authored changes
- `ROADMAP-INDEX.md` — tracking roadmap coverage across the organization
- `project-starter/README.md` — creating new repositories with org patterns baked in
