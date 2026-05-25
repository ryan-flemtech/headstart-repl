# AGENTS.md — Headstart Coding Classroom REPL Platform

Quick-reference guide for Claude Code and Codex sessions. Read this at the start of every session.

For full detail: **SPEC.md**. For file roles: **CODEBASE_MAP.md**. For lesson JSON: **LESSON_SCHEMA.md**. For feature list: **FEATURES.md**.

---

## Project Summary

A browser-based coding classroom tool for Headstart Coding live sessions and solo study.
Two applications in this repo:

1. **Classroom App** — student/teacher coding environment (`/`)
2. **Lesson Builder** — teacher-facing tool for creating and testing lesson JSON files (`/builder`)

Both are static React apps deployed to GitHub Pages. No backend server exists or should be added.

---

## Tech Stack

| Concern | Solution |
|---|---|
| Framework | React (functional components + hooks only — no class components) |
| Build tool | Vite |
| Hosting | GitHub Pages |
| Real-time sync | Firebase Realtime Database (free tier) — classroom app only |
| Python execution | Pyodide (WASM) in a Web Worker — classroom app AND lesson builder |
| Web output | Sandboxed iframe with Blob URL virtual filesystem — classroom app AND lesson builder |
| Scratch blocks | Custom scratch-blocks (Blockly fork) with hand-rolled interpreter — classroom app only |
| Code editor | CodeMirror 6 |
| Markdown | react-markdown + rehype-highlight |
| Styling | CSS custom properties in a shared global stylesheet (`src/index.css`) |

Do not add any other major dependencies without confirming with the user.

---

## Repository Structure

```
/
├── SPEC.md              # Full specification — full detail on every behaviour
├── AGENTS.md            # This file — quick reference for sessions
├── CLAUDE.md            # Claude Code session checklist (read first)
├── LESSON_SCHEMA.md     # Lesson JSON schema reference
├── FEATURES.md          # Implemented features list
├── CODEBASE_MAP.md      # One-line role for every file — use for navigation
├── index.html           # Classroom app entry
├── builder/index.html   # Lesson builder entry
├── lessons/             # Static lesson JSON files
├── src/
│   ├── App.jsx          # Classroom router (HashRouter)
│   ├── main.jsx         # Classroom entry point
│   ├── index.css        # Global styles and brand CSS custom properties
│   ├── app/
│   │   ├── components/  # UI components (19 files)
│   │   ├── hooks/       # useIdentity.js, useSession.js
│   │   └── views/       # LandingPage, LessonRoute, StudentView, TeacherView
│   ├── builder/
│   │   ├── App.jsx      # Builder root — lesson lifecycle and persistence
│   │   ├── main.jsx     # Builder entry point
│   │   ├── components/  # Builder-specific components
│   │   └── views/       # BuilderView, PreviewView
│   └── shared/          # Shared modules — used by BOTH apps (never duplicate)
│       ├── CodeEditor.jsx
│       ├── SplitPane.jsx
│       ├── AssetBrowser.jsx
│       ├── checks.js
│       ├── codemirror.js
│       ├── firebase.js
│       ├── iframe.js
│       ├── markdown.jsx
│       ├── pyodide.js
│       ├── pyodide.worker.js
│       ├── scratch.js
│       ├── taskUtils.js
│       └── useIsMobile.js
├── public/
├── vite.config.js
└── package.json
```

---

## Shared Modules — Critical

Both apps import from `src/shared/`. Never duplicate this logic.

| Module | Key exports / role |
|---|---|
| `CodeEditor.jsx` | Shared CodeMirror wrapper — language/readOnly switching via compartments, no remount |
| `SplitPane.jsx` | Draggable two-pane splitter; clamped [15%, 85%]; right pane can collapse to fixed width |
| `AssetBrowser.jsx` | Read-only lesson asset file browser with click-to-copy and image hover preview |
| `checks.js` | `evaluateCheckResults(check, output, context)` — all check types, `CHECK_TYPES` constants |
| `codemirror.js` | `createBaseExtensions(type, readOnly)`, `headstartTheme`, `headstartHighlight`, `getTabSize(type)` |
| `firebase.js` | Exports `db` (Firebase Realtime Database reference, initialized from env vars) |
| `iframe.js` | `buildIframeSrc(files, entryFile, options)`, `waitForIframeText(timeout)` |
| `markdown.jsx` | `MarkdownRenderer({content, title, style})`, `InlineMarkdown({content})` — supports `img` via standard Markdown image syntax |
| `pyodide.js` | `initPyodide()`, `runPython(code, {onOutput?, onInputRequired?})`, `stopPython()`, `provideInput(value)` |
| `pyodide.worker.js` | Web Worker: Pyodide loader, async `input()` AST transform, stdout/stderr streaming |
| `scratch.js` | Block definitions, interpreter, `createRunContext()`, `createSpriteState()`, `createRunSignal()` |
| `taskUtils.js` | `flattenTasks(tasks)`, `getProgressItems(tasks)`, `updateSubtaskTitles(tasks)` |
| `useIsMobile.js` | `useIsMobile(breakpoint=640) → boolean` |

---

## Firebase Data Model

**Critical — do not deviate from this structure.**

```json
{
  "sessions": {
    "{lessonId}": {
      "state": "waiting | active | sandbox | ended",
      "currentTaskId": 1,
      "createdAt": 1234567890,
      "isPaused": false,
      "activeStudentView": "{anonymousId} | null",
      "teacherLive": {
        "active": true,
        "source": "teacher | student",
        "sourceStudentId": "uuid | null",
        "sourceStudentName": "Jamie | null",
        "taskId": 1,
        "lessonType": "python",
        "code": "...",
        "files": { "index__dot__html": "..." },
        "output": "...",
        "runStatus": "success | error | stopped | submitted | null",
        "checkPassed": true,
        "updatedAt": 1234567890
      },
      "sandboxCode": "string | null",
      "sandboxCodePushedAt": 1234567890,
      "sandboxFiles": { "index__dot__html": "..." },
      "sandboxFilesUpdatedAt": 1234567890,
      "students": {
        "{anonymousId}": {
          "displayName": "Jamie",
          "joinedAt": 1234567890,
          "online": true,
          "currentCode": "string",
          "currentFiles": { "index__dot__html": "..." },
          "currentOutput": "string",
          "currentAnswer": "b",
          "lastRunStatus": "success | error | null",
          "checkPassed": true,
          "lastRunAt": 1234567890,
          "remoteResetAction": "starter | complete",
          "remoteResetPushedAt": 1234567890
        }
      }
    }
  }
}
```

**File key encoding:** Firebase keys cannot contain dots. `index.html` is stored as `index__dot__html`. Always use `encodeFileKey`/`decodeFileKey` from `useSession.js`. App state and localStorage use the real filenames.

### Write rules

- Teacher writes: `state`, `currentTaskId`, `isPaused`, `activeStudentView`, `teacherLive`, `sandboxCode`, `sandboxCodePushedAt`, `sandboxFiles`, `sandboxFilesUpdatedAt`, any student's `displayName`, student node removal
- Teacher — remote reset: `remoteResetAction` + `remoteResetPushedAt` on individual student node
- Student (on run): own `currentCode`/`currentFiles`, `currentOutput`, `lastRunStatus`, `checkPassed`, `lastRunAt`
- Student (when watched — Python): `currentCode` per keystroke, `currentOutput` line by line during run
- Student (when watched — HTML): `currentFiles` per active-tab keystroke
- Student (quiz): `currentAnswer` on submit
- Firebase v1 security rules are open read/write — do not add authentication logic

### onDisconnect handlers

- `activeStudentView` cleared when teacher disconnects
- `teacherLive` set to null when teacher disconnects
- Student `online` **key removed** on disconnect (not set to false)
- Session node deleted when teacher calls `endSession()` and disconnects

---

## localStorage Keys

**Critical — do not deviate from these key formats.**

| Key | Value |
|---|---|
| `headstart_identity` | `{ anonymousId, displayName, lastSessionTimestamp }` |
| `headstart_{lessonId}_{taskId}_{anonymousId}` | `{ code?, output?, runStatus?, state? }` — Python/Scratch |
| `headstart_{lessonId}_{taskId}_{filename}_{anonymousId}` | `{ content }` — HTML per-file |
| `headstart_builder_current` | Full lesson JSON object |

---

## URL Structure

| URL | Behaviour |
|---|---|
| `/` | Landing page — student enters lesson ID |
| `/lesson/:lessonId` | Solo student mode |
| `/lesson/:lessonId?live=true` | Live student mode (joins Firebase session) |
| `/lesson/:lessonId?teacher=true` | Teacher view |
| `/lesson/:lessonId?teacher=true&present=true` | Teacher presentation (StudentView watching teacherLive) |
| `/builder` | Lesson builder |

No room IDs. One session per lesson. `?teacher=true` is the only auth mechanism.

---

## Session States

| State | Meaning |
|---|---|
| `waiting` | Session created — students in waiting room |
| `active` | Live lesson — teacher controls current task |
| `sandbox` | Freeform mode — no task, no checks |
| `ended` | Session finished |

`isPaused: true` overlays any state to freeze student navigation without ending the session.

---

## Identity Model

- Anonymous ID: random UUID generated on first visit, stored in `localStorage`
- Display Name: separate — teacher can rename without affecting keys or localStorage
- Session timestamp comparison: stored `lastSessionTimestamp` vs Firebase `createdAt`
  - Match → same session → skip name entry, restore work
  - Differ → new session → fresh name entry, new Anonymous ID
- Duplicate names get numeric suffix: `Jamie` → `Jamie-2` → `Jamie-3`

---

## Key Behaviours — Do Not Get These Wrong

### Code carry-through
- Check localStorage for `carryCodeFrom` task ID before loading `starterCode`
- Per-file for HTML lessons — carry each file independently by filename
- Scratch: `carryBlocksFrom` works identically
- Fallback chain: saved carry → starterCode/starterFiles → empty editor

### Live view (activeStudentView)
- Default expanded view shows last-run snapshot only — no streaming
- Streaming activates only when teacher clicks "Go Live"
- On "Go Live": one-time fetch first, then set `activeStudentView`
- Closing modal by ANY means (button, click outside, Escape, tab close) must clear `activeStudentView`
- Firebase `onDisconnect` clears `activeStudentView` on unexpected tab close
- Only one student streams at a time

### Teacher live broadcast (teacherLive)
- Separate from `activeStudentView` — broadcasts teacher's or a student's screen to ALL students
- Opens via `?teacher=true&present=true` presentation window
- `onDisconnect` clears `teacherLive` automatically

### Remote reset
- Teacher writes `remoteResetAction` ("starter" or "complete") + `remoteResetPushedAt` to student node
- Student detects timestamp change and applies reset silently (no prompt)

### Sandbox mode
- Student code saved to localStorage BEFORE editor clears on sandbox entry
- Sandbox content discarded on return to lesson — never saved to localStorage
- `sandboxCodePushedAt` / `sandboxFilesUpdatedAt` timestamps used as change triggers (not the values)
- HTML sandbox: files stored with `__dot__` encoding in Firebase

### Pyodide
- Runs in a Web Worker — never blocks the main thread
- `stopPython()` terminates the worker to kill infinite loops; replacement pre-warmed immediately
- `input()` handled via Python AST transform; resolved when `provideInput()` is called

### File key encoding (Firebase)
- Always use `encodeFileKey`/`decodeFileKey` from `useSession.js` when reading/writing `currentFiles` or `sandboxFiles`
- App state and localStorage use raw filenames with real dots

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
- Do not deviate from Firebase data model or localStorage key formats
- Do not duplicate Pyodide, iframe, CodeMirror, checks, or Markdown logic — always use shared modules
- Do not store Firebase file keys with raw dots — always encode with `encodeFileKey`
- Do not add dependencies without confirming with the user

---

## Git Workflow

When implementing any new feature, always create a branch before writing any code:

```bash
git checkout -b feature/<short-kebab-case-description>
```

All feature work happens on this branch — never commit directly to `main`. Keep branches focused: one feature per branch.

**Branch naming conventions:**
- `feature/` — new functionality
- `fix/` — bug fixes
- `refactor/` — code restructuring with no behaviour change

When the feature is complete, commit with a descriptive message and push to remote:

```bash
git push -u origin feature/<branch-name>
```

Then open a pull request using the GitHub CLI:

```bash
gh pr create --title "<Feature title>" --body "<summary of what was implemented, any non-obvious decisions made, and how to verify it works>"
```

Do not merge the PR — leave it open for review.

### Responding to PR review comments

When a commit is made in response to a PR review comment, always post a follow-up reply on that PR comment thread explaining what was changed and which commit addresses it:

```bash
gh pr comment <pr-number> --body "Addressed in <commit-sha>: <brief explanation of what was changed>"
```

When asked to handle or address a comment on a pull request, always reply directly to that comment thread — even before starting work — to acknowledge what will be done. Once the commit is made, post a follow-up reply on the same thread explaining what was changed and which commit addresses it:

```bash
# Reply to a specific review comment thread
gh api repos/{owner}/{repo}/pulls/comments/{comment_id}/replies \
  --method POST --field body="Addressed in <commit-sha>: <brief explanation of what was changed>"

# Or post a general PR comment
gh pr comment <pr-number> --body "Addressed in <commit-sha>: <brief explanation of what was changed>"
```

### Closing the worktree after submitting a PR

After `gh pr create` completes successfully, exit and remove the worktree using the ExitWorktree tool (or, if running in a terminal, `git worktree remove <path>`). This keeps the repo tidy and signals that the branch is in review.

---

## Testing

Read **TESTING.md** for full detail on tool choices, layer definitions, coverage thresholds, and what NOT to test.

### Standing instructions — follow these on every session that touches tests or code

**Test runner:** `npm test` (Vitest, unit + component). `npm run test:e2e` (Playwright, E2E). Never run tests via a raw `node` or `vite` command.

**Where tests live:**
- Unit and component tests: `src/**/__tests__/*.test.{js,jsx}` — mirroring source directory layout
- E2E tests: `e2e/*.spec.js`
- No co-located test files (never `src/shared/checks.test.js` next to `checks.js`)

**Before writing a new test file:**
1. Read the source file you are testing — never assume function signatures
2. Check whether a `__tests__/` directory already exists for that location; if not, create it
3. Mock at the module boundary, not inside the implementation

**Mock rules:**
- Firebase: `vi.mock('firebase/database', ...)` — never let tests hit the real database
- localStorage: use jsdom's built-in; call `localStorage.clear()` in `beforeEach`
- `window.matchMedia`: already mocked globally in `src/test/setup.js`
- `URL.createObjectURL` / `URL.revokeObjectURL`: already mocked globally in `src/test/setup.js`
- `crypto.randomUUID`: already mocked globally in `src/test/setup.js`
- Pyodide / Web Worker: mock the `pyodide.js` manager interface with `vi.mock`; never import the worker directly in tests
- `react-router-dom`: mock `useNavigate`, `useParams`, `useSearchParams` as needed per component

**When adding a new source file:**
- If it exports pure functions → add a unit test file in the matching `__tests__/` directory
- If it is a React component or hook → add a component test file
- If it changes a critical user journey → consider whether an E2E test needs updating

**Coverage thresholds** are set deliberately low while complex components (StudentView, TeacherView, useSession, builder views) remain untested. Do not raise thresholds until the corresponding tests exist. See the phase table in TESTING.md.

**Do not test:**
- Firebase `onDisconnect` behaviour (requires real network disconnection)
- Pyodide WASM execution (Web Worker; test the `pyodide.js` interface only via mock)
- Scratch VM rendering (canvas-based, not jsdom-compatible)
- CodeMirror `EditorView` internals (test config factories only)

**E2E tests (Playwright):**
- Only cover flows that do NOT require Firebase — solo student flows and builder flows
- Firebase-dependent flows (live session, remote reset, activeStudentView) require Firebase Emulator and are out of scope until that infrastructure is set up
- Base URL: `http://localhost:5173/editor/` — the Vite base is `/editor/`, not `/`
- Hash routes: use `page.goto('#/lesson/:lessonId')` — Playwright prepends the baseURL

**When the test suite fails in CI or before a build:**
- `npm test` exits non-zero → `npm run build` will also fail (via `prebuild` lifecycle hook)
- Fix the failing tests before merging or deploying — do not lower thresholds to make the build pass

---

## Doc Hygiene

After any significant change, update the relevant section of SPEC.md, LESSON_SCHEMA.md, or this file before closing the task. Update CODEBASE_MAP.md when files are added, moved, or removed.

When a library or CDN module is added, removed, or upgraded to a new major version, update **LICENSES.md** with the package name, version, and license. Check the license in the package's `package.json` or repository — pay particular attention to copyleft licenses (AGPL, GPL) before adding anything new.

---

*Last updated: May 2026 — merged from AGENTS.md + CLAUDE.md following codebase audit.*
