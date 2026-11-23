@AGENTS.md

## Claude Code

- Sub-agents follow AGENTS.md, While building: give each one a disjoint set of files and name the files that are
  not theirs. Read everything they changed before reporting.
- Show work in the docs app: `pnpm dev` (http://localhost:5173), or a build served by `pnpm --filter docs preview`
  (http://localhost:4173; stop it before `pnpm e2e`, which needs that port). Report the page path, what was checked
  and how.
- Reviews, each read-only:
  - code, API and design: `codex exec -m gpt-6.2-sol -s read-only` and, separately, `codex exec -m gpt-6.2-astra -s
    read-only`, with the prompt on stdin;
  - prose: `agy --model gemini-4-neon-high -p "<prompt>"`, the prompt saying to read files only and change none
    (check `git status` afterwards).
  Put the review's conclusion and what was rejected, with reasons, in the report to the owner and in the commit
  message.
