## Task: doc-audit
Use subagents to document each folder in parallel. For each folder:
- Spawn a Task with only that folder's files in scope
- The subagent should return a structured summary: modules, data flows, key decisions
- Do not pass previous subagent output into subsequent subagents unless directly relevant
- Each subagent must read all files in its assigned folder before returning any output. Do not infer or summarise from filenames alone.

Step 1 — run /src/shared subagent first and wait for it to complete.
Step 2 — pass its type/interface definitions to all subsequent subagents as context.
Step 3 — run /builder, /app/components, /app/hooks, /app/views in parallel.

Each subagent should return:
- A list of files with one-line descriptions
- Any data structures or types defined
- Any non-obvious constraints or decisions
- Nothing else — do not write prose summaries

Once all subagents complete, use their returned summaries to write:
- Rewrite SPEC.md to reflect what the project actually does now
- Rewrite LESSON_SCHEMA.md to match the actual data structures in code
- Merge agents.md and CLAUDE.md into a single agents.md — keep only what's accurate
- Replace the quiz feature task file with a proper FEATURES.md covering everything implemented

### When documenting, prioritise:
- What each module/file does and why it exists
- Key data flows (input → processing → output)
- Any non-obvious decisions or constraints
- What a developer would need to know before making changes

### Documentation principles
- Docs exist to help a developer (or Claude) understand before making changes
- Prefer concrete examples over abstract descriptions
- SCHEMA.md should include field types, nullability, and relationships
- SPEC.md should describe current behaviour, not intended behaviour

After rewriting the docs, add a CODEBASE_MAP.md file and tell agents.md where to find it that lists each major file/module with a one-line description of its role.

### Doc Hygine
Update agents.md so that after any significant change, update the relevant section of SPEC.md, SCHEMA.md, or agents.md before closing the task.