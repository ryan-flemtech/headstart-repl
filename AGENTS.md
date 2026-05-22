# AGENTS.md — Headstart Coding Classroom REPL Platform

This file provides persistent context for Codex sessions working on this project.
Always read this file at the start of every session before writing any code.
For full detail on every feature, read SPEC.md.

---

## Project Summary

A browser-based coding classroom tool for Headstart Coding live sessions and solo study.
Two applications live in this repo:

1. **Classroom App** — the main student/teacher coding environment (`/`)
2. **Lesson Builder** — a teacher-facing tool for creating and testing lesson JSON files (`/builder`)

Both are static React apps deployed to GitHub Pages. No backend server exists or should be added.

---

## Tech Stack

| Concern | Solution |
|---|---|
| Framework | React (functional components + hooks only — no class components) |
| Build tool | Vite |
| Hosting | GitHub Pages |
| Real-time sync | Firebase Realtime Database (free tier) — classroom app only |
| Python execution | Pyodide (WASM) — classroom app AND lesson builder |
| Web output | Sandboxed iframe with Blob URL virtual filesystem — classroom app AND lesson builder |
| Scratch blocks | scratch-blocks (fork of Google Blockly) — classroom app only |
| Scratch execution | scratch-vm + scratch-render — classroom app only |
| Code editor | CodeMirror 6 |
| Markdown | react-markdown + rehype-highlight |
| Styling | CSS modules or Tailwind — confirm before starting |

Do not add any other major dependencies without checking the spec and confirming with the user.

---

## Repository Structure

```
/
├── SPEC.md                         # Full project specification — read this
├── AGENTS.md                       # This file
├── index.html                      # Classroom app entry
├── builder/
│   └── index.html                  # Lesson builder entry
├── lessons/
│   ├── python-intro.json           # Sample Python lesson
│   └── web-intro.json              # Sample HTML lesson
├── src/
│   ├── app/                        # Classroom app source
│   │   ├── components/
│   │   ├── hooks/
│   │   └── views/
│   ├── builder/                    # Lesson builder source
│   │   ├── components/
│   │   └── views/
│   └── shared/                     # Shared modules — used by BOTH apps
│       ├── codemirror.js           # CodeMirror setup and config
│       ├── markdown.jsx            # react-markdown renderer
│       ├── iframe.js               # Virtual filesystem / Blob URL logic
│       └── pyodide.js              # Pyodide loader and execution
├── public/
├── vite.config.js
└── package.json
```

---

## Shared Modules — Critical

Both apps share execution and rendering logic via `src/shared/`. Never duplicate this logic.

| Module | Contents |
|---|---|
| `codemirror.js` | CodeMirror base config, language modes, theme, all extensions |
| `markdown.jsx` | react-markdown renderer with rehype-highlight |
| `iframe.js` | Blob URL generation, file reference rewriting, iframe injection |
| `pyodide.js` | Pyodide loader, stdin intercept, stdout hook, run function |
| `scratch.js` | scratch-vm factory, scratch-render attachment, storage setup, check evaluation, DEFAULT_PROJECT, DEFAULT_TOOLBOX |

Both the classroom app and lesson builder import from these modules. Build the shared modules first.

---

## Lesson JSON Format

Lessons are static JSON files in `/lessons/`. There are two types.

### Python lesson

```json
{
  "id": "python-intro",
  "type": "python",
  "title": "Introduction to Python",
  "description": "Short description shown on entry screen.",
  "tasks": [
    {
      "id": 1,
      "title": "Hello World",
      "explainer": "Use `print()` to show output.\n\n```python\nprint('Hello')\n```",
      "starterCode": "# Write your code here\n",
      "carryCodeFrom": null,
      "check": {
        "type": "output_contains",
        "value": "Hello"
      }
    }
  ]
}
```

### HTML/CSS/JS lesson

```json
{
  "id": "web-intro",
  "type": "html",
  "title": "Introduction to HTML",
  "description": "Short description.",
  "tasks": [
    {
      "id": 1,
      "title": "Your First Page",
      "explainer": "Add a heading using `<h1>`.",
      "entryFile": "index.html",
      "carryCodeFrom": null,
      "starterFiles": [
        {
          "name": "index.html",
          "type": "html",
          "content": "<!DOCTYPE html>\n<html>\n<body>\n\n</body>\n</html>"
        },
        {
          "name": "style.css",
          "type": "css",
          "content": "/* styles here */\n"
        }
      ],
      "check": {
        "type": "output_contains",
        "value": "Hello"
      }
    }
  ]
}
```

### Rules
- `id` values are sequential integers starting at 1
- `carryCodeFrom` is a task `id` integer or null
- `check` is optional — omit the field entirely if not needed
- `starterCode` and `starterFiles` are both optional
- Only check type in v1 is `output_contains`

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
      "activeStudentView": "{anonymousId} | null",
      "sandboxCode": "string | null",
      "sandboxCodePushedAt": 1234567890,
      "students": {
        "{anonymousId}": {
          "displayName": "Jamie",
          "currentCode": "string",
          "currentFiles": {
            "index.html": "string",
            "style.css": "string"
          },
          "currentOutput": "string",
          "lastRunStatus": "success | error | null",
          "checkPassed": true,
          "lastRunAt": 1234567890,
          "joinedAt": 1234567890
        }
      }
    }
  }
}
```

### Write rules
- Teacher writes: `state`, `currentTaskId`, `activeStudentView`, `sandboxCode`, `sandboxCodePushedAt`, any student's `displayName`
- Student writes: their own node under `students/{anonymousId}` only
- `currentCode` / `currentFiles` written on run normally, per keystroke only when `activeStudentView` matches their Anonymous ID
- `currentOutput` written line by line during run when being watched (Python), on run completion otherwise
- Firebase v1 security rules are open read/write — do not add authentication logic

---

## localStorage Keys

**Critical — do not deviate from these key formats.**

### Student work — Python
```
headstart_{lessonId}_{taskId}_{anonymousId}
```
Value: `{ code: string, output: string, runStatus: "success" | "error" | null }`

### Student work — HTML/CSS/JS (one entry per file)
```
headstart_{lessonId}_{taskId}_{filename}_{anonymousId}
```
Value: `{ content: string }`

### Student identity
```
headstart_identity
```
Value: `{ anonymousId: string, displayName: string, lastSessionTimestamp: number }`

### Lesson builder state
```
headstart_builder_current
```
Value: full lesson JSON object

---

## Identity Model

- Anonymous ID is a random UUID generated on first visit, stored in `localStorage` (not `sessionStorage`)
- Display Name is separate from Anonymous ID — teacher can rename without affecting keys
- On page load, compare `lastSessionTimestamp` in localStorage against Firebase `sessionCreatedAt`
  - Match → same session → skip name entry, restore work, greet by name
  - Differ → new session → fresh name entry, generate new Anonymous ID
- Duplicate names get numeric suffix: `Jamie` → `Jamie-2` → `Jamie-3`

---

## URL Structure

| URL | Behaviour |
|---|---|
| `/lesson/:lessonId` | Student entry point |
| `/lesson/:lessonId?teacher=true` | Teacher view |
| `/builder` | Lesson builder |

- No room IDs — one session per lesson at a time
- `?teacher=true` is the only auth mechanism in v1 — do not add password logic

---

## Session States

| State | Meaning |
|---|---|
| `waiting` | Session created, teacher hasn't started yet — students in waiting room |
| `active` | Live lesson in progress — teacher controls task |
| `sandbox` | Freeform mode — no task, no checks |
| `ended` | Session finished |

---

## Key Behaviours — Do Not Get These Wrong

### Code carry-through
- Check localStorage for `carryCodeFrom` task ID before loading `starterCode`
- Per-file for HTML lessons — carry each file independently by filename
- Graceful fallback: carry → starterCode → empty editor

### Live view (activeStudentView)
- Default expanded view shows last-run snapshot only — no streaming
- Streaming only activates when teacher clicks "Go Live"
- On "Go Live": one-time fetch first, then set `activeStudentView`
- Closing modal by ANY means (button, click outside, Escape, tab close) must clear `activeStudentView`
- Use Firebase `onDisconnect` to clear `activeStudentView` on unexpected tab close
- Only one student streams at a time

### Sandbox mode
- Student code saved to localStorage BEFORE editor clears on sandbox entry
- Sandbox code is discarded on return to lesson — never saved
- Push to All is forced — no student prompt
- `sandboxCodePushedAt` timestamp used as change trigger (not the code itself)

### Output / iframe updates during live view
- Code mirror updates per keystroke (always during live view)
- Python output updates line by line during a run only — not between runs
- HTML iframe re-renders on Run only — not per keystroke
- Between runs: output panel / iframe holds last run state

### Student grid
- Dynamic — no hard cap, renders however many students are present
- Soft recommended max of 12 for UI comfort

---

## Lesson Builder — Execution

The builder includes full code execution. It is NOT just a form editor.

### Python execution in builder
- Pyodide loaded on first Run — same shared module as classroom app
- Loading screen: "Getting Python ready…"
- Run button beneath starter code editor
- Full output panel — same styling as classroom app
- `input()` supported — inline input field in output panel
- Each run is a fresh execution context

### HTML execution in builder
- Run button beneath file editor
- Sandboxed iframe preview beneath Run button
- Same virtual filesystem / Blob URL shared module as classroom app
- Multi-file projects render correctly

### Check verification in builder
- After Run, if task has a completion check: evaluate it against actual output
- Show result beneath output panel:
  - ✅ Green: "Check passes — students will see the completion banner"
  - ⚠️ Amber: "Check does not pass with this output — review your check value"
- Informational only — does not block saving or downloading
- Validation warning added if check exists but has never been tested

---

## CodeMirror Shared Config

All CodeMirror instances across both apps must use the same base configuration from `src/shared/codemirror.js`. Key settings:

- Python: `@codemirror/lang-python`, tab size 4
- HTML: `@codemirror/lang-html`, tab size 2
- CSS: `@codemirror/lang-css`, tab size 2
- JavaScript: `@codemirror/lang-javascript`, tab size 2
- Autocomplete on, triggers per keystroke, not in comments or strings
- Auto-indentation on
- Line numbers on
- Bracket matching on
- Active line highlight on
- Read-only mode toggled programmatically

---

## Pyodide Notes

- Load Pyodide once per session — not on demand per run
- Shared loading logic in `src/shared/pyodide.js` — used by both classroom app and builder
- Show loading screen: "Getting Python ready…" with progress indicator
- `input()` must be intercepted — execution pauses, inline input field shown in output panel
- Each run uses a fresh execution context — no state between runs
- Only stdlib — no pip installs in v1
- No file I/O

---

## iframe Virtual Filesystem

Shared logic in `src/shared/iframe.js` — used by both classroom app and builder:
- Convert each file to a Blob URL
- Scan HTML entry file for `href` and `src` attributes referencing other files
- Rewrite those references to Blob URLs
- Inject rewritten HTML into sandboxed iframe

iframe sandbox attributes: `allow-scripts allow-same-origin`
Do not add `allow-forms`, `allow-top-navigation`, or `allow-popups`.

---

## Brand & Theming

All UI across both apps must use the Headstart Coding brand. Apply these as CSS custom properties at the root level in a shared stylesheet imported by both apps.

### CSS Custom Properties

```css
:root {
  /* Colours */
  --colour-primary:        #6222CC;
  --colour-primary-dark:   #4e1aa3;   /* darken for hover states on primary elements */
  --colour-secondary:      #FBA504;
  --colour-secondary-dark: #e09400;   /* darken for hover states on buttons */
  --colour-text:           rgb(58, 59, 60);
  --colour-text-on-primary: #ffffff;  /* white text on primary purple backgrounds */
  --colour-text-on-secondary: #ffffff; /* white text on secondary yellow buttons */

  /* Typography */
  --font-title:  'Montserrat', sans-serif;
  --font-body:   'Quicksand', sans-serif;
  --font-code:   'JetBrains Mono', monospace;

  /* Font weights */
  --font-weight-title: 700;  /* Montserrat Bold */
  --font-weight-body:  400;
  --font-weight-body-medium: 600;
}
```

### Google Fonts Import

Both apps must import these fonts at the top of the root stylesheet:

```css
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700&family=Quicksand:wght@400;600&family=JetBrains+Mono&display=swap');
```

### Usage Rules

| Element | Font | Colour |
|---|---|---|
| Page titles, section headings | Montserrat Bold | White (`--colour-text-on-primary`) on primary purple background |
| Task titles, card headings | Montserrat Bold | `--colour-text` or white depending on background |
| Body text, explainers, labels | Quicksand | `--colour-text` |
| Buttons (primary actions) | Quicksand Medium | White on `--colour-secondary` (#FBA504) |
| Code in editors | JetBrains Mono | Determined by CodeMirror theme |
| Code in explainers | JetBrains Mono | Determined by CodeMirror theme |

### Colour Application

| Element | Colour |
|---|---|
| Section backgrounds, top bars, panels | `--colour-primary` (#6222CC) |
| Primary buttons (Run, Start Session, Download) | `--colour-secondary` (#FBA504) |
| Secondary buttons, outlines | `--colour-primary` with white text |
| Hover states on primary buttons | `--colour-secondary-dark` |
| Status — success | Green — `#22c55e` |
| Status — error | Red — `#ef4444` |
| Status — not run | Grey — `#9ca3af` |
| Check passed | Green — `#22c55e` |
| Read-only editor tint | Muted red — `rgba(239, 68, 68, 0.08)` |
| Card backgrounds | White |
| Page background | `#f5f5f5` or white |

### CodeMirror Theme

Use a light CodeMirror theme that complements the purple/yellow brand without clashing. Suggested: a custom light theme with:
- Editor background: `#fafafa`
- Active line: `#f0eafa` (light purple tint)
- Selection: `#e9d5ff`
- Gutter background: `#f0f0f0`
- Syntax colours: standard light theme palette

Do not use a dark editor theme — the overall UI is light and a dark editor would be jarring.

### Notes

- Never use Inter, Roboto, Arial, or system fonts — always Montserrat for titles and Quicksand for body
- Montserrat is titles and headings only — do not use it for body copy or labels
- Quicksand handles all body text, labels, button text, and UI copy
- Yellow (`--colour-secondary`) is for buttons and key interactive elements — do not use it as a background for large areas
- Purple (`--colour-primary`) is the dominant brand colour — use it confidently for section backgrounds and top bars

---

## What Not To Do

- Do not add a backend server or API
- Do not add authentication or login beyond `?teacher=true`
- Do not use `sessionStorage` for the Anonymous ID — use `localStorage`
- Do not write student code to Firebase on every keystroke unless `activeStudentView` matches
- Do not re-render the iframe on every keystroke during live view — only on Run
- Do not hardcode student limits
- Do not add pip install support in v1
- Do not add file I/O support in v1
- Do not deviate from the Firebase data model or localStorage key formats
- Do not duplicate Pyodide, iframe, CodeMirror, or Markdown logic — always use shared modules
- Do not add dependencies not listed in this file without confirming with the user

---

## Recommended Build Order

1. Vite + React scaffolding and repo structure
2. Shared modules: CodeMirror config, Markdown renderer, iframe virtual filesystem, Pyodide loader
3. Lesson Builder — form editor, explainer preview, code execution, check verification, export/import
4. Classroom app — static first (hardcoded lesson, no Firebase)
5. Classroom app — Python execution (shared Pyodide module already built)
6. Classroom app — HTML/CSS/JS iframe execution (shared iframe module already built)
7. Classroom app — Firebase session lifecycle and student sync
8. Classroom app — teacher view and student grid
9. Classroom app — live view and sandbox mode
10. Polish, GitHub Pages deployment, cross-browser testing

---

## Session Start Checklist

At the start of every Codex session:
1. Read this file (AGENTS.md)
2. Read SPEC.md for the feature being worked on today
3. Review existing code in the relevant directory before writing anything new
4. Confirm the narrow goal for this session before starting

---

*Last updated: Specification v2.2*
