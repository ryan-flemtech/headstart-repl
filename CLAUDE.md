# CLAUDE.md — Headstart Coding Classroom REPL Platform

This file provides Claude Code session instructions. For the full project quick-reference, read **AGENTS.md**. For file roles, read **CODEBASE_MAP.md**. For full technical detail, read **SPEC.md**. For lesson JSON, read **LESSON_SCHEMA.md**.

---

## Session Start Checklist

At the start of every Claude Code session:
1. Read this file (CLAUDE.md)
2. Read AGENTS.md for the project quick-reference (Firebase model, localStorage keys, URL structure, key behaviours)
3. Read CODEBASE_MAP.md for file navigation before touching code
4. Review existing code in the relevant directory before writing anything new
5. Confirm the narrow goal for this session before starting

---

## What Not To Do

- Do not add a backend server or API
- Do not add authentication beyond `?teacher=true`
- Do not use `sessionStorage` for the Anonymous ID — use `localStorage`
- Do not write student code to Firebase per keystroke unless `activeStudentView` matches
- Do not re-render the iframe per keystroke during live view — only on Run
- Do not hardcode student limits
- Do not add pip install support
- Do not add file I/O support
- Do not deviate from the Firebase data model or localStorage key formats (see AGENTS.md)
- Do not duplicate Pyodide, iframe, CodeMirror, checks, or Markdown logic — always use shared modules
- Do not store Firebase file keys with raw dots — always use `encodeFileKey`/`decodeFileKey` from useSession.js
- Do not add dependencies without confirming with the user

---

## Doc Hygiene

After any significant change, update the relevant section of SPEC.md, LESSON_SCHEMA.md, or AGENTS.md before closing the task. Update CODEBASE_MAP.md when files are added, moved, or removed. Update LICENSES.md when a library or CDN module is added, removed, or upgraded to a new major version.

---

*Last updated: May 2026 — CLAUDE.md now delegates detail to AGENTS.md.*
