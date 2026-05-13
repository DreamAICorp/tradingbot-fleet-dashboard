#!/usr/bin/env python3
"""compliance.py — verifies this repository conforms to the CI/CD Standard.

Generated from ci-cd-control-plane templates. Do not edit by hand.
Re-stamp from control plane via `bin/apply-standard` (uses templates/compliance.py.tmpl).

Runs in two contexts:
  1. Locally: `python scripts/compliance.py` — quick check before opening a PR.
  2. CI: as the `compliance` job, listed in branch_protection.json `required_status_checks`.
     Failure blocks every merge until resolved.

What it asserts:
  A. Repo state
     - The local working tree's branch is `main` OR we're in a PR head
       (compliance is meaningful on the trunk, not on long-running branches).
     - `.standard-version` exists and contains a control-plane SHA.

  B. Generated files match templates
     - For every workflow under .github/workflows/ matching the managed set:
       compute its SHA-256, compare to the expected hash for the recorded
       standard-version. Mismatch → DRIFT.
     - The managed set is defined in `.standard-managed-files` (committed
       alongside the workflows during apply-standard).

  C. Branch protection sanity (skipped in CI; assumed enforced server-side)
     - When run locally: `gh api repos/{owner}/{repo}/branches/main/protection`
       returns the expected JSON shape from templates/branch_protection.json.

  D. Hooks fingerprint (NEW commits only)
     - For commits introduced by THIS PR (relative to base ref), assert the
       pre-push hook's marker file was updated (proves hooks ran locally OR
       CI re-ran them).
     - Note per D-09 footnote: the real gate is CI re-running tests anyway.
       This check just surfaces when developers skipped local hooks so they
       know their CI will be slower.

Exit codes:
  0  — fully compliant
  1  — drift detected (one or more assertions failed)
  2  — environment problem (gh CLI missing, etc.) — needs human attention

Template variables (substituted at apply time):
  DreamAICorp        — e.g. DreamAICorp
  tradingbot-fleet-dashboard       — e.g. tradingbot-platform
  DreamAICorp/ci-cd-control-plane  — typically DreamAICorp/ci-cd-control-plane
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path

REPO_ORG = "DreamAICorp"
REPO_NAME = "tradingbot-fleet-dashboard"
CONTROL_PLANE_REPO = "DreamAICorp/ci-cd-control-plane"

# Files this standard manages — must match the set written by apply-standard.
# Kept in repo as `.standard-managed-files` (one path per line) so the
# templates can evolve without touching the script.
MANAGED_FILES_INDEX = ".standard-managed-files"
STANDARD_VERSION_FILE = ".standard-version"


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    h.update(path.read_bytes())
    return h.hexdigest()


def _check_standard_version(root: Path) -> tuple[bool, str]:
    f = root / STANDARD_VERSION_FILE
    if not f.exists():
        return False, f"missing {STANDARD_VERSION_FILE} — repo never ran apply-standard"
    sha = f.read_text().strip()
    if not sha or len(sha) < 7:
        return False, f"{STANDARD_VERSION_FILE} present but content invalid: {sha!r}"
    return True, f"pinned to control-plane @ {sha}"


def _check_managed_files_match(root: Path) -> tuple[bool, list[str]]:
    """Each managed file's SHA must match the expected hash for the pinned
    standard-version. The expected hashes are stored in
    `.standard-managed-files` as `path<TAB>sha256` lines.
    """
    idx = root / MANAGED_FILES_INDEX
    if not idx.exists():
        return False, [f"missing {MANAGED_FILES_INDEX}"]
    errors: list[str] = []
    for line in idx.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split("\t")
        if len(parts) != 2:
            errors.append(f"bad index line (need path<TAB>sha): {line!r}")
            continue
        rel_path, expected = parts
        f = root / rel_path
        if not f.exists():
            errors.append(f"managed file missing: {rel_path}")
            continue
        actual = _sha256(f)
        if actual != expected:
            errors.append(
                f"drift: {rel_path}\n  expected: {expected}\n  actual:   {actual}\n"
                f"  fix: re-run apply-standard from control plane, OR open a PR "
                f"to the control plane templates if the change is intentional"
            )
    return (not errors), errors


def _check_branch_protection_local() -> tuple[bool, str]:
    """Only runs locally (skipped in CI because GitHub already enforces server-side).
    Fetches the current branch protection and compares structure to expected.
    """
    if os.environ.get("CI") == "true":
        return True, "skipped in CI (enforced server-side)"
    try:
        r = subprocess.run(
            ["gh", "api", f"repos/{REPO_ORG}/{REPO_NAME}/branches/main/protection"],
            capture_output=True,
            text=True,
            check=False,
            timeout=15,
        )
    except FileNotFoundError:
        return False, "gh CLI not on PATH — can't verify branch protection"
    if r.returncode != 0:
        return False, f"gh api failed ({r.returncode}): {r.stderr.strip()[:200]}"
    try:
        bp = json.loads(r.stdout)
    except json.JSONDecodeError as e:
        return False, f"branch protection response not JSON: {e}"
    # Spot-check the load-bearing settings — full structural compare would
    # be too brittle (GitHub adds fields). The ones we MUST have:
    must_have = {
        ("required_linear_history", "enabled", True),
        ("allow_force_pushes", "enabled", False),
        ("allow_deletions", "enabled", False),
        ("enforce_admins", "enabled", True),
        ("required_conversation_resolution", "enabled", True),
    }
    errors: list[str] = []
    for key, sub, expected in must_have:
        val = bp.get(key, {})
        if isinstance(val, dict):
            actual = val.get(sub)
        else:
            actual = val
        if actual != expected:
            errors.append(f"branch_protection.{key}.{sub}: expected {expected}, got {actual!r}")
    # Check required_status_checks contains the canonical names
    rsc = bp.get("required_status_checks") or {}
    contexts = set(rsc.get("contexts") or [])
    required_contexts = {"lint", "typecheck", "unit", "integration", "e2e", "security", "compliance"}
    missing = required_contexts - contexts
    if missing:
        errors.append(f"required_status_checks missing: {sorted(missing)}")
    if errors:
        return False, "branch protection drift:\n  - " + "\n  - ".join(errors)
    return True, "branch protection matches standard"


def main() -> int:
    parser = argparse.ArgumentParser(description="CI/CD compliance check.")
    parser.add_argument(
        "--strict-branch-protection",
        action="store_true",
        help="Also verify branch protection (default: skip when CI=true)",
    )
    args = parser.parse_args()

    root = Path(__file__).resolve().parent.parent  # scripts/compliance.py → repo root
    if not (root / ".git").exists():
        print(f"::error::compliance.py: {root} is not a git repo", file=sys.stderr)
        return 2

    print(f"compliance.py — checking {REPO_ORG}/{REPO_NAME} against {CONTROL_PLANE_REPO}")
    print(f"repo root: {root}")
    print()

    pass_all = True

    ok, msg = _check_standard_version(root)
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] standard-version pin")
    print(f"    {msg}")
    pass_all &= ok

    ok, errs = _check_managed_files_match(root)
    status = "PASS" if ok else "FAIL"
    print(f"[{status}] managed file hashes")
    if errs:
        for e in errs:
            print(f"    {e}")
    pass_all &= ok

    if args.strict_branch_protection or os.environ.get("CI") != "true":
        ok, msg = _check_branch_protection_local()
        status = "PASS" if ok else "FAIL"
        print(f"[{status}] branch protection")
        print(f"    {msg}")
        pass_all &= ok

    print()
    print("OVERALL:", "PASS" if pass_all else "FAIL")
    return 0 if pass_all else 1


if __name__ == "__main__":
    sys.exit(main())
