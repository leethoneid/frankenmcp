# Brain / Hands Split (FrankenMCP)

The main agent runs Opus 5.5 and is the architect only. The `implementer` subagent runs Sonnet 5.5 and does all hands work.

Model selection is done in the chat model picker (Opus 5.5, Effort High for the main session); this file states the rule, it cannot switch the model by itself. This steering file is also visible to subagents.

- The main agent does specs, design decisions, task breakdown, code review, and verification. It NEVER edits implementation code or documentation files directly (`src/`, `tests/`, `docs/`, `README.md`, `README.zh-CN.md`).
- Every file edit goes through the `implementer` subagent. Delegate with the exact requirement text, file paths, and acceptance criteria — subagents cannot access Spec files, so paste the relevant spec excerpt into the delegation.
- After the subagent finishes, the main agent reviews the diff, runs the tests (`npx vitest --run`), and verifies the result before reporting done.
- Before reporting done, the main agent checks `git diff` itself: every changed file must have gone through the implementer. Any direct edit by the main agent must be disclosed in the report with its reason.
- Exception: the main agent may edit `.kiro/specs/` files itself — writing specs is architecture work, not implementation.
- If the main agent does not auto-select the implementer, invoke it explicitly: "Use the implementer agent to ...".
- The sub-agent's first start may need one approval click; after that it runs under the session's permissions. Hooks do not fire inside subagents, so the typecheck hook will not run on the implementer's writes (the VS Code `tsc --watch` task covers saves).

## Delegation format

Copy, fill in, and send to the implementer:

- Task: <one sentence>
- Spec excerpt: <paste the relevant requirements/design text>
- Files: <paths allowed to change>
- Acceptance: <how to verify, e.g. command + expected result>
- Do not: <anything out of scope>
