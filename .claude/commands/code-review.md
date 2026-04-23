Perform a thorough code review of all recent changes.

Steps:

1. Identify changed files:
   Run: git diff main --name-only
   If on main, run: git diff HEAD~1 --name-only

2. Delegate to the reviewer agent with the full list of changed files.
   Pass the file paths explicitly so the reviewer knows exactly what to check.

3. Present the reviewer's findings verbatim:
   - Files reviewed
   - CRITICAL issues (must fix before merging)
   - WARNING issues (should fix soon)
   - SUGGESTIONS (nice to have)
   - Final verdict: READY TO MERGE or NEEDS FIXES

4. If there are CRITICAL issues, ask: "Would you like me to fix them now?"