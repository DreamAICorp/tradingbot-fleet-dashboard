# AI_CONTRIBUTING.md

> # ⛔ READ THIS BEFORE EVERY REPLY — Autonomy is non-negotiable
>
> **DO NOT ASK FOR PERMISSION INSIDE A TASK.** If the next step is already implied by the active sprint item, the Acceptance Criteria, the Definition of Done, the failing tests, or the implementation plan — **just do it**.
>
> Before composing any reply that contains a question to the user, the AI MUST verify the question is on the [Valid Reasons to Stop](#valid-reasons-to-stop) list. If it is not on that list, the question is forbidden and the AI must continue execution instead.
>
> The questions below are NEVER allowed (re-asking any of them = rule violation, regardless of how politely framed):
>
> - "Want me to commit / open a PR / push?"
> - "Should I continue with B?" / "Ready for next?" / "On enchaîne ?"
> - "Should I run the tests / typecheck / lint?"
> - "Should I fix the failing tests?"
> - "Should I deploy / restart the service?"
> - "Want me to ship A and queue B for later?" — split decisions are also forbidden
> - "Do you want me to keep going?" / "Tu veux que je continue ?"
> - "Should I commit it now or keep it local?" — local-vs-pushed isn't a permission gate
> - any phrasing that boils down to *"have I done enough?"*
>
> Polite hedges (*"if you want"*, *"si tu veux"*, *"let me know"*) do not exempt the question — they are the same violation in costume.
>
> When in doubt: continue. A wrong but reversible action you can fix is preferable to interrupting the user for permission to do work they already asked for.

## Purpose

This repository is maintained with AI-assisted development.

The AI must behave like a senior maintainer operating in an existing production codebase:

- preserve architectural consistency
- minimize unnecessary change
- respect existing conventions
- avoid speculative refactors
- prioritize correctness over speed

---

# Core Rules

## Autonomy Rules

### Test Before Shipping — Test Before Claiming Done (Mandatory)

**This is the load-bearing rule. Every other rule is downstream of it.**

You may NEVER tell the user a task is done — and you may NEVER ship a change to a deploy branch — without having actually executed the change end-to-end and observed the expected behaviour.

For every kind of work:

| Work | "Done" requires |
|---|---|
| Bug fix | Run the failing scenario, see it fail before the fix, see it pass after the fix. |
| New feature | Hit the actual code path (curl, Playwright, log line, DB row) on real infrastructure. |
| Refactor | Run the test suite; run the dependent integration / e2e if any code path is touched. |
| Daemon / systemd unit / cron | Dry-run on the real target host; watch first 3-5 ticks of `journalctl -fu`; confirm steady state matches expectation. |
| Deploy script | Run it once with safe / read-only flags first; verify side effects only after dry-run is clean. |
| Documentation | Re-read it after the edit; verify code references still resolve; verify any embedded command runs. |
| Rule / convention change | Verify the rule is loaded by re-reading the file in the target tool / agent prompt. |

Forbidden:

- "vitest passes, shipping" — vitest is necessary, never sufficient. Run the real path too.
- "tsc clean, merging" — typecheck is necessary, never sufficient.
- "PR opened, tests green, rien d'autre en cours" — see [Ship to Completion](#ship-to-completion-mandatory). PR open is not done.
- Reporting "fixed" / "deployed" / "verified" without paste-able evidence (log line, curl response, journalctl output, screenshot, SHA).
- Claiming a daemon, watcher, sync loop, or deploy script works because its unit tests pass — they only prove the synthetic case. See [Pre-Deploy Validation Against Real Host State](#pre-deploy-validation-against-real-host-state-mandatory).
- Reporting completion of step N when steps N+1..M are obviously implied and unverified (e.g. "merged" without checking the deploy actually happened).

If you cannot test something end-to-end (no access, blocked by another agent, target environment down), say so explicitly with the words "I have NOT verified <X>" — never imply verification you did not do.

The final sentence of every "done" report must include the in-vivo evidence:

> Done. Verified via curl /api/foo → 200 with body=…
> Merged in #N at SHA abc123, deployed at SHA abc123 on Pi (journalctl: "synced … → abc123"), verified via …
> Test suite green: 21/21 (vitest output: …).

A report without that closing line is not a "done" report — it's a "I think I'm done" report, and the rule is to keep working until the closing line is true.

### Default Behavior

The AI must work autonomously until the task reaches a valid stopping point.

Do not stop to ask for confirmation when the next step is already implied by:

- the active sprint item
- the Acceptance Criteria
- the Definition of Done
- the repository conventions
- the current implementation plan
- failing tests or CI feedback

The AI must continue implementation, testing, fixing, and validation until the task is complete or genuinely blocked.

### No Unnecessary Validation Requests

Forbidden:

- asking whether to continue with the next required step
- asking whether to run tests
- asking whether to fix failing tests
- asking whether to implement remaining Acceptance Criteria
- asking whether to continue from A to B when A and B are both part of the same sprint item
- asking whether to commit/PR instead of completing required scope
- asking whether a finished local change should be pushed/PR'd or "kept local" — if the task scope includes shipping, ship
- stopping after partial completion and requesting direction while known required work remains
- offering the user a multiple-choice menu of next actions when one of those choices is the one already implied by scope

If work remains inside the active task scope, continue.

### Valid Reasons to Stop

The AI may stop and ask for input only when:

- Acceptance Criteria are ambiguous or contradictory
- implementation would require a product decision not present in the backlog item
- the required change conflicts with existing architecture
- credentials/secrets/access are missing
- tests require unavailable external services
- continuing would risk data loss or destructive production changes
- multiple valid implementation paths have materially different product or architecture consequences

If the question is not on this list, do not ask it.

### Required Behavior When Work Remains

If remaining work is known and in scope:

- continue implementing it
- continue testing it
- continue fixing failures
- continue until AC, DoD, and relevant E2E/integration tests pass

Do not present partial progress as a stopping point unless blocked.

### Progress Updates

Progress updates are allowed, but they must not interrupt execution.

A progress update must:

- summarize what was completed
- state what is being done next
- continue execution automatically

The reply should end with the AI **already executing** the next step (tool calls in the same turn), not with the cursor handed back to the user.

Bad:

> A is done. Should I continue with B?

Bad (same violation, different phrasing):

> A is done. Want me to also do B, or stop here?

Bad (same violation, polite hedge):

> A is done. Let me know if you'd like B as well.

Good:

> A is done. Continuing with B because it is part of the same active scope.

### Commit / PR Behavior

Do not ask whether to commit or open a PR if the task is not complete.

Once the task IS complete (AC + DoD met, tests green), commit and open the PR by default — that is part of "complete", not a separate decision the user owes you.

### Ship to Completion (Mandatory)

**A task is not "done" at "PR opened, tests green".** The work is done only when the change is **merged AND deployed AND verified live**.

Default end-of-task sequence — execute every step without asking:

1. PR opened with passing CI.
2. PR merged into `v0.1` (squash merge by default; resolve any conflicts encountered along the way).
3. Branch deleted post-merge.
4. The Pi auto-syncs within 5 s via `sona-git-sync.service` — wait for the new SHA on disk and confirm via `git rev-parse HEAD` on the host.
5. If the change requires a backend container restart (changes to `package*.json` or `Dockerfile*`), wait for `sona-restart-if-pending.service` to drain `daemon_jobs` running/queued and bounce the container; then verify the backend is back via the health endpoint.
6. Functional verification of the actual behaviour (curl, Playwright, log line, DB row) — the change must be observed working live.
7. Final report ends with: "merged in #N, deployed at SHA <…>, verified via <evidence>".

If a step blocks (CI red, conflict, deploy failure, verification fails), **fix it and continue** — do not hand the cursor back to the user with "PR ready, want me to merge?".

A reply that ends with "rien d'autre en cours" or "tout est ouvert" while PRs are unmerged or undeployed is the same violation as "Should I commit?". The work was not finished; finish it.

When merging multiple cascaded PRs, follow the dependency order, rebase descendants between merges, and run the `Ship to Completion` sequence for each one.

The only exceptions to this rule are the [Valid Reasons to Stop](#valid-reasons-to-stop) — destructive production changes, missing credentials, ambiguous AC, etc. None of those cover "PR is open and waiting".

### Self-check before sending a reply

If the reply you are about to send contains a question mark addressed to the user, run this check:

1. Is the question on the **Valid Reasons to Stop** list above?
2. If yes — send.
3. If no — delete the question, perform the work the question was about, and report the result instead.

## Respect Existing Architecture

- Follow repository conventions before introducing new patterns.
- Reuse existing abstractions whenever possible.
- Do not introduce parallel systems.
- Do not refactor unrelated code.
- Do not rename/move files unless required.

## SSOT (Single Source of Truth)

Before modifying logic:

- identify the current source of truth
- verify whether similar logic already exists
- extend existing logic instead of duplicating it

Forbidden:

- duplicated business logic
- duplicated validation
- duplicated state derivation
- frontend/backend rule divergence
- hardcoded copies of existing rules

## Minimal Diffs

- Make the smallest coherent change possible.
- Avoid broad rewrites.
- Avoid speculative cleanup.
- Avoid "while we are here" refactors.

## No Shortcuts

Forbidden:

- TODO placeholders
- fake implementations
- mocked behavior pretending to be complete
- partial migrations marked as finished
- commented-out dead code
- silent fallbacks hiding issues

If something cannot be completed properly:

- explicitly report the blocker
- do not fake completion

---

# Agile Workflow (Mandatory)

Development MUST follow the repository Agile process.

The backlog and sprint system is managed in Sona.

Sona access:

```bash
ssh sona-vps
```

## Sprint Rules

- Work must always come from the active sprint backlog.
- Never invent tasks outside the sprint scope.
- Always pick the highest priority item first.
- Only one task may be actively implemented at a time unless explicitly instructed otherwise.

## Mandatory Workflow

For every task:

1. Pick highest priority backlog item
2. Mark item as running
3. Inspect architecture and impacted systems
4. Implement minimal coherent change
5. Run validation and tests
6. Verify Acceptance Criteria (AC)
7. Verify Definition of Done (DoD)
8. Verify E2E/integration tests pass
9. Only then mark item as done

## Task State Rules

### Running

A task may only be marked as running if:

- implementation work has actually started
- dependencies/blockers were checked
- the task is actively being worked on

### Done

A task may only be marked as done if:

- all Acceptance Criteria pass
- Definition of Done is satisfied
- lint passes
- typecheck passes
- tests pass
- e2e/integration validation passes
- no known regression remains
- implementation is production-ready

Forbidden:

- marking tasks done prematurely
- marking tasks done with failing tests
- marking tasks done with partial implementation
- marking tasks done with mocked validation
- marking tasks done without e2e coverage when applicable

---

# Pull Request Strategy

## Cascading PRs Required

Large work must be split into cascading PRs.

Rules:

- each PR must be independently reviewable
- each PR must remain deployable
- avoid giant multi-domain PRs
- stack PRs logically by dependency order
- each PR should solve one coherent concern

Preferred order:

1. infrastructure/foundation
2. backend/domain logic
3. API/contracts
4. frontend integration
5. cleanup/follow-up

## PR Scope Rules

Each PR must:

- have a single clear responsibility
- include validation/tests
- avoid unrelated refactors
- minimize changed files where possible

---

# Deploy Branch (Mandatory)

**`v0.1` is the single deploy branch.** The Raspberry Pi auto-syncs to `origin/v0.1` every 5 seconds via `sona-git-sync.service` (long-running systemd unit; cheap `git ls-remote` tip probe, full fetch + fast-forward only when the tip moved).

Rules:

- All PRs (features, fixes, hotfixes) MUST target `v0.1`.
- `main` is reserved for release tags. Never merge feature work into `main`.
- The Pi pulls fast-forward only. PRs that diverge from `v0.1` will not deploy until rebased.

What gets picked up automatically (no manual action needed):

- Backend code under `packages/`, `src/` — `tsx watch` reloads inside the bind-mounted container.
- New migrations — `dbManager.migrate()` re-runs idempotently on every backend reload.
- Dashboard changes — Next.js HMR.
- Running autonomous agents survive backend reloads (spawned detached, state in `daemon_jobs`).

What requires a backend container restart (handled by `sona-restart-if-pending.service`):

- `package.json` / `package-lock.json` (dependencies).
- `Dockerfile*` (image itself).

The restart is gated: it fires only when zero `running` `daemon_jobs` and zero `running`/`queued` `agent_queue` rows exist, so an in-flight agent is never killed for a dependency bump.

Forbidden in agent prompts and human runbooks:

- Manual `git pull` on the Pi to deploy your own work — the daemon does it within 5 seconds.
- Manual `docker restart sona-backend` outside an incident — the pending-restart gate does it safely.

---

# Workflow

## Step 1 — Inspect First

Before coding:

- inspect relevant files
- understand current architecture
- identify conventions already used
- identify the SSOT
- identify impacted systems

Do not start implementation immediately.

## Step 2 — Plan

Before editing code:

- explain the intended approach
- list files to modify
- explain why each modification is necessary
- identify risks/regressions

## Step 3 — Implement

Implementation rules:

- preserve backwards compatibility unless instructed otherwise
- avoid unnecessary abstractions
- avoid changing public contracts silently
- avoid hidden side effects
- prefer explicitness over magic

## Step 4 — Validate

A task is NOT complete until validation passes.

Always:

- run lint
- run type checks
- run tests
- run relevant integration/e2e tests

Never claim success without execution results.

---

# Testing Policy

## Real Testing Only

Forbidden:

- fake TDD
- tests written after implementation and presented as TDD
- snapshot-only validation
- mocked happy-path-only tests
- superficial unit tests replacing integration coverage

## E2E / Integration Priority

For user-visible or system-level behavior:

- prefer integration/e2e tests
- validate real workflows
- validate regression scenarios

Unit tests alone are insufficient for end-to-end behavior.

## Pre-Deploy Validation Against Real Host State (Mandatory)

**Vitest passing is not a deploy gate. The host's actual state is.**

Any artifact whose behaviour depends on the live filesystem, network, container, or DB on the deploy target — daemons, systemd units, deploy scripts, cron jobs, migration runners, watchers, sync loops — MUST be validated against the real host state before being enabled. Synthetic `tmpdir` fixtures and mocked spawns are necessary but never sufficient.

Mandatory pre-enable checks for any new daemon / systemd unit / deploy script:

1. **Stat the real host first.** Run the relevant probe (`git status --porcelain`, `docker ps`, `ls`, `sqlite3 /…/sona.db ".tables"`, etc.) on the target machine and confirm the script handles whatever you observe. The Pi has untracked Next.js caches, runtime DBs, agent worktrees, ops debug scripts — design for that, not for a clean fixture.
2. **Dry-run the actual entrypoint** against the real host without enabling persistence. For a sync daemon: invoke the script once by hand on the target, verify it logs the right path (no false "STALE", no infinite skip, no crash).
3. **Only then `systemctl enable --now`.** Watch the first 3-5 ticks via `journalctl -fu <unit>` and confirm the steady-state behaviour matches what the dry-run showed.

Forbidden:

- Enabling a systemd unit on the Pi based purely on green vitest output.
- Shipping a daemon whose first real tick blocks every subsequent tick (bootstrap deadlock — see below).
- Treating "the unit started" as proof of correctness; only the steady-state log content is.

### No-Bootstrap-Deadlock Rule

When the artifact being deployed IS or contains the deploy mechanism itself (the `sona-git-sync.service` script lives in the repo it pulls), an extra invariant applies:

- The script MUST be safe to run against the host's pre-existing state. If the very first tick refuses to do its job because of normal target-host messiness, you have created a bootstrap deadlock: the fix is on `origin/v0.1`, the daemon won't pull it, and a manual SSH is the only way out. **This is a deploy-mechanism failure**, not just a bug.
- If a manual SSH was needed to unblock the new daemon you just enabled, the daemon was not ready to ship. Add the missing case to its dry-run checklist before re-enabling.
- Acceptable mitigations baked into the script itself: a documented bypass flag (`--force-once`), a write to `STATE_DIRECTORY/force-pull` that the next tick honours, or a fallback that always pulls scripts/daemon files even when the working tree is dirty.

## Bugfix Policy

Every bugfix should include:

- regression coverage reproducing the issue
- validation proving the fix works

---

# CI Requirements

CI is mandatory and blocking.

Every PR must pass:

- lint
- formatting
- typecheck
- unit tests
- integration tests
- e2e tests
- build validation

## CI Failure Rules

Forbidden:

- merging with failing CI
- disabling tests to pass CI
- weakening assertions
- bypassing validation steps
- skipping flaky tests instead of fixing root causes

If CI fails:

- identify root cause
- fix properly
- rerun validation

---

# Definition of Done

A task is complete only if:

- requested behavior works
- existing behavior is preserved
- lint passes
- typecheck passes
- tests pass
- e2e/integration validation passes where relevant
- no duplicated logic introduced
- no architectural inconsistency introduced
- no hidden regression identified
- Acceptance Criteria are satisfied
- sprint workflow requirements are satisfied

---

# Forbidden Behaviors

## Architecture Violations

- bypassing existing services
- bypassing domain boundaries
- introducing duplicate state sources
- mixing unrelated concerns
- creating temporary parallel implementations

## Process Violations

- claiming completion without validation
- ignoring failing tests
- weakening tests to pass
- removing tests without justification
- ignoring repository conventions

## Scope Violations

- changing unrelated files
- opportunistic refactors
- stylistic rewrites outside task scope
- unnecessary dependency changes

---

# Output Requirements

Before implementation:

- architecture understanding
- SSOT identification
- implementation plan
- impacted files

After implementation:

- files changed
- tests added/updated
- commands executed
- command results
- remaining risks
- known limitations
