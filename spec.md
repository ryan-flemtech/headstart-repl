# Headstart Coding — Classroom REPL Platform
## Complete Project Specification v2.2

---

# Part 1 — Classroom App

---

## 1. Overview

A browser-based coding classroom tool for Headstart Coding live sessions and solo study. Supports Python lessons and HTML/CSS/JS web lessons. No backend server. Static hosting on GitHub Pages. Real-time sync via Firebase Realtime Database. Python execution via Pyodide (WASM). Web lesson output via sandboxed iframe. Replaces Pickcode / Juicemind. Student count is dynamic — no hard cap, soft recommended maximum of 12 for UI comfort. Single teacher per session at a time.

---

## 2. Terminology

| Term | Definition |
|---|---|
| **Lesson** | A complete unit of work, made up of ordered Tasks |
| **Task** | A single coding challenge within a Lesson |
| **Session** | A live teacher-led instance of a Lesson |
| **Sandbox Mode** | A freeform coding state the teacher can activate at any point during a session |
| **Solo Mode** | Student works through a Lesson independently, no teacher |
| **Anonymous ID** | A random UUID generated on first visit, persisted in localStorage |
| **Display Name** | The human-readable name shown in UI, separate from Anonymous ID |
| **Active View** | The student the teacher is currently watching in expanded view |
| **Session Timestamp** | A timestamp written to Firebase when a session is created, used to detect new sessions on shared devices |
| **Code Carry-Through** | A task setting that loads the student's saved code from a previous task rather than fresh starter code |
| **Entry File** | The file loaded into the iframe when a web lesson task is run |
| **Virtual Filesystem** | The in-browser Blob URL system used to resolve links between files in a web lesson |

---

## 3. System Architecture

| Concern | Solution |
|---|---|
| Hosting | GitHub Pages (static) |
| Real-time sync | Firebase Realtime Database (free tier) |
| Python execution | Pyodide (in-browser WASM) — Python lessons only |
| Web lesson output | Sandboxed iframe with virtual filesystem — HTML/CSS/JS lessons only |
| Lesson content | Static JSON files in the GitHub repo under `/lessons/` |
| Student work persistence | Browser localStorage, keyed by Anonymous ID |
| Markdown rendering | `react-markdown` with syntax highlight plugin |
| Future proof-of-work | Firebase already captures run data — export UI stubbed but inactive in v1 |

No code leaves the student's browser during execution. Firebase only receives run results and current code — never raw execution.

---

## 4. URL Structure

| URL | Behaviour |
|---|---|
| `/lesson/:lessonId` | Student entry — checks Firebase for active session for this lesson |
| `/lesson/:lessonId?teacher=true` | Teacher view — creates and owns the session |

The teacher's "Share Link" button copies `/lesson/:lessonId`. There is at most one active session per lesson at any time.

---

## 5. Lesson & Task Data Format

Lessons are static JSON files committed to the repo under `/lessons/`.

### 5.1 Lesson Envelope

```json
{
  "id": "python-intro",
  "type": "python",
  "title": "Introduction to Python",
  "description": "Your first steps with Python — printing, variables, and input.",
  "tasks": []
}
```

```json
{
  "id": "web-intro",
  "type": "html",
  "title": "Introduction to HTML & CSS",
  "description": "Build your first webpage.",
  "tasks": []
}
```

The `type` field — `"python"` or `"html"` — controls which editor mode, execution method, and output panel the app renders. All other behaviour (session lifecycle, Firebase sync, carry-through, sandbox, live view) is identical across lesson types.

---

### 5.2 Python Task Object

```json
{
  "id": 3,
  "title": "Extend Your Greeter",
  "explainer": "Now let's extend the greeter you built in the last task.\n\nAdd a second `input()` to ask for the user's age, then print a message using **both** their name and age.\n\n```python\nname = input('What is your name? ')\n# now add age below\n```",
  "starterCode": "name = input('What is your name? ')\n",
  "carryCodeFrom": 2,
  "check": {
    "type": "output_contains",
    "value": "years old"
  }
}
```

#### Python Task Field Reference

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | ✅ | integer | Sequential, used for ordering and localStorage keys |
| `title` | ✅ | string | Short — shown in progress tracker |
| `explainer` | ✅ | string | Markdown string — rendered above the editor |
| `starterCode` | ❌ | string | Fallback code pre-filled on task load if carry-through is absent or unavailable |
| `carryCodeFrom` | ❌ | integer | Task `id` to carry student's saved code from. Takes priority over `starterCode` if prior work exists |
| `check` | ❌ | object | Optional completion check |

---

### 5.3 HTML/CSS/JS Task Object

```json
{
  "id": 2,
  "title": "Link Two Pages",
  "explainer": "Now let's link `index.html` to `about.html` using an anchor tag.",
  "entryFile": "index.html",
  "carryCodeFrom": 1,
  "starterFiles": [
    {
      "name": "index.html",
      "type": "html",
      "content": "<!DOCTYPE html>\n<html>\n<body>\n  <h1>Home</h1>\n</body>\n</html>"
    },
    {
      "name": "about.html",
      "type": "html",
      "content": "<!DOCTYPE html>\n<html>\n<body>\n  <h1>About</h1>\n</body>\n</html>"
    },
    {
      "name": "style.css",
      "type": "css",
      "content": "/* shared styles */\n"
    }
  ],
  "check": {
    "type": "output_contains",
    "value": "About"
  }
}
```

#### HTML/CSS/JS Task Field Reference

| Field | Required | Type | Notes |
|---|---|---|---|
| `id` | ✅ | integer | Sequential |
| `title` | ✅ | string | Short — shown in progress tracker |
| `explainer` | ✅ | string | Markdown — rendered above editor tabs |
| `starterFiles` | ❌ | array | Array of file objects |
| `entryFile` | ❌ | string | Filename to load as iframe entry point. Defaults to `index.html` |
| `carryCodeFrom` | ❌ | integer | Task `id` to carry files from — per-file carry |
| `check` | ❌ | object | Optional completion check |

#### File Object

| Field | Required | Notes |
|---|---|---|
| `name` | ✅ | Actual filename e.g. `index.html`, `style.css` — used for tab label, localStorage key, and virtual filesystem |
| `type` | ✅ | `html`, `css`, or `javascript` — determines CodeMirror language mode |
| `content` | ✅ | Starter file content as a string |

---

### 5.4 Python Carry-Through Behaviour

```
Task loads and carryCodeFrom is set:
→ Look up localStorage for headstart_{lessonId}_{carryFromId}_{anonymousId}
→ If found: load saved code into editor
→ If not found: fall back to starterCode
→ If neither: load empty editor
```

---

### 5.5 HTML/CSS/JS Carry-Through Behaviour

Carry-through is per file, matched by filename:

```
Task loads and carryCodeFrom is set:
→ For each file in starterFiles:
   → Look up localStorage for headstart_{lessonId}_{carryFromId}_{filename}_{anonymousId}
   → If found: load saved content into that file's editor tab
   → If not found: load starterFiles content for that file

Files added in the new task that didn't exist in the carried task:
→ Load fresh from starterFiles

Files in the carried task not present in the new task:
→ Not shown — tabs only render files defined in current task's starterFiles
```

---

### 5.6 Check Types (v1)

| Type | Behaviour | Python | HTML |
|---|---|---|---|
| `output_contains` | Last run stdout / iframe document body text includes the specified string (case-insensitive) | ✅ | ✅ |

Additional check types reserved for future: `variable_equals`, `function_exists`, `output_matches_regex`.

---

## 6. Explainer Markdown

The `explainer` field supports a subset of Markdown, rendered above the editor.

### Supported Syntax

| Syntax | Renders as |
|---|---|
| `` `code` `` | Inline code — monospace, styled to match CodeMirror font and theme |
| ```` ```python ... ``` ```` | Fenced Python code block — syntax highlighted, matches editor |
| ```` ```html ... ``` ```` | Fenced HTML code block — syntax highlighted |
| ```` ```css ... ``` ```` | Fenced CSS code block — syntax highlighted |
| ```` ```javascript ... ``` ```` | Fenced JS code block — syntax highlighted |
| `**bold**` | Bold text |
| Plain text / line breaks | Rendered as paragraphs |

Not supported: images, headings, tables, lists, links.

Renderer: `react-markdown` with `rehype-highlight` or `react-syntax-highlighter`. All code blocks match the CodeMirror editor font and colour scheme for visual consistency throughout.

---

## 7. Identity Model

### 7.1 Anonymous ID

- Generated as a random UUID on first ever visit to any lesson URL
- Stored in `localStorage` — persists across tab closes, browser restarts, and rejoins
- Keys all Firebase student nodes and all localStorage work entries
- Never changes unless the student manually clears their browser storage

### 7.2 Display Name

- Entered by the student on first join to a session
- Stored in `localStorage` alongside the Anonymous ID and session timestamp
- Separate from the Anonymous ID — can be changed by teacher without affecting any keys
- On rejoin to the same session: name entry skipped, student greeted by stored name
- On new session detected via timestamp comparison: name entry shown fresh

### 7.3 Session Timestamp & Shared Device Detection

When a student joins a session:
- Firebase `sessionCreatedAt` timestamp is read
- Stored in localStorage as `lastSessionTimestamp`

On any subsequent visit:
- Stored `lastSessionTimestamp` compared to Firebase `sessionCreatedAt`
- **Match** → same session, same device user → skip name entry, restore work, greet: "Welcome back, Jamie!"
- **Differ** → new session → fresh name entry, new Anonymous ID generated

| Scenario | Behaviour |
|---|---|
| Jamie drops and rejoins same session | Timestamps match → welcomed back, work restored |
| Jamie returns next week for a new session | Timestamps differ → fresh name entry |
| Jamie's friend picks up Jamie's laptop | Timestamps differ → fresh name entry, new Anonymous ID |

### 7.4 Duplicate Name Handling

- Numeric suffix appended automatically if name exists in session: `Jamie` → `Jamie-2` → `Jamie-3`
- Suffixed name confirmed to student before proceeding

### 7.5 Teacher Name Override

- Pencil icon on student card — updates `displayName` in Firebase only
- Anonymous ID and localStorage unaffected

### 7.6 localStorage Key Format

**Python:**
```
headstart_{lessonId}_{taskId}_{anonymousId}
```
Stores: `{ code: string, output: string, runStatus: "success" | "error" | null }`

**HTML/CSS/JS — one entry per file:**
```
headstart_{lessonId}_{taskId}_{filename}_{anonymousId}
```
Stores: `{ content: string }`

### 7.7 localStorage Identity Entry

```
headstart_identity
```
Stores: `{ anonymousId: string, displayName: string, lastSessionTimestamp: number }`

---

## 8. Firebase Data Model

One session node per lesson. No room IDs. Student count dynamic.

```json
{
  "sessions": {
    "{lessonId}": {
      "state": "waiting | active | sandbox | ended",
      "currentTaskId": 1,
      "createdAt": 1234567890,
      "activeStudentView": "{anonymousId} | null",
      "sandboxCode": "# starter code or html here",
      "sandboxCodePushedAt": 1234567890,
      "students": {
        "{anonymousId}": {
          "displayName": "Jamie",
          "currentCode": "print('hello')",
          "currentFiles": {
            "index.html": "<!DOCTYPE html>...",
            "style.css": "body { color: red; }"
          },
          "currentOutput": "hello\n",
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

### Notes

- `currentCode` used for Python lessons
- `currentFiles` used for HTML/CSS/JS lessons — keyed by filename
- `currentOutput` used for Python text output only
- For HTML/CSS/JS lessons there is no `currentOutput` — the iframe renders from `currentFiles` directly
- Both `currentCode`/`currentFiles` written per keystroke during live view, on run only otherwise
- `currentOutput` written line by line during a Python run when live view is active, on run completion only otherwise

### Write Rules

| Writer | Writes to |
|---|---|
| Teacher | `state`, `currentTaskId`, `activeStudentView`, `sandboxCode`, `sandboxCodePushedAt`, any student's `displayName` |
| Student — Python, normal | `currentCode`, `currentOutput`, `lastRunStatus`, `checkPassed`, `lastRunAt` on run |
| Student — Python, when watched | `currentCode` per keystroke, `currentOutput` line by line during run |
| Student — HTML, normal | `currentFiles`, `lastRunStatus`, `checkPassed`, `lastRunAt` on run |
| Student — HTML, when watched | `currentFiles` per keystroke in active tab, on run only for iframe content |
| System on join | Creates student node with `displayName`, `joinedAt` |

---

## 9. On-Demand Live Streaming

By default the expanded student view shows code and output as of the student's last run. The teacher activates live streaming per student on demand.

### 9.1 Default Expanded View

- Shows last-run snapshot from Firebase
- Python: `currentCode` in editor, `currentOutput` in output panel
- HTML: `currentFiles` in tabbed editor, iframe rendered from last run files
- No streaming active — `activeStudentView` not set
- Normal Firebase listener only — no extra write cost

### 9.2 Activating Live View

```
Teacher clicks "Go Live" in expanded view
→ One-time fetch of currentCode / currentFiles and currentOutput from Firebase
→ Loaded into expanded view immediately — no blank state
→ activeStudentView set to student's Anonymous ID
→ Student client detects flag:
   Python: push currentCode per keystroke, currentOutput line by line during run
   HTML:   push currentFiles per keystroke in active tab
→ Teacher's code mirror updates per keystroke
→ Teacher's output panel (Python) updates during run only
→ Teacher's iframe (HTML) re-renders on Run only — not per keystroke
→ Button changes to "Stop Live"
```

### 9.3 Output and iframe Behaviour During Live View

**Python:**
```
Student hits Run
→ Output streams to Firebase line by line
→ Teacher sees output appear line by line
→ input() prompt text written to Firebase as it appears
→ Teacher can see student is waiting for input
→ Between runs: output panel holds last run state
```

**HTML/CSS/JS:**
```
Student hits Run
→ currentFiles written to Firebase
→ Teacher's iframe re-renders with updated files
→ Between runs: iframe holds last run state
→ Code mirror still updates per keystroke — teacher sees typing in real time
```

### 9.4 Deactivating Live View

Any of the following clears `activeStudentView` immediately:
- Teacher clicks "Stop Live"
- Teacher clicks close button on modal
- Teacher clicks outside modal
- Teacher presses Escape
- Teacher's tab closes — Firebase `onDisconnect` handler fires

Closing the modal always cleans up live view automatically — no separate stop step needed.

### 9.5 Firebase Usage Estimate

| Mode | Writes per session |
|---|---|
| Run-only, all students, full session | ~200–400 writes |
| Live streaming, one student, per minute | ~400–800 writes/min |
| Typical session with occasional live views | Comfortably within 100k/day free tier |

---

## 10. Web Lesson — iframe Virtual Filesystem

For multi-file web lessons, links between files (e.g. `href="about.html"`, `src="style.css"`, `src="script.js"`) must resolve correctly inside the sandboxed iframe.

### 10.1 Approach

Each file is converted to a Blob URL on run. References between files in the HTML are rewritten to point to the corresponding Blob URLs before injection into the iframe.

```
Student hits Run
→ All currentFiles converted to Blob URLs
→ HTML file scanned for href and src references to other files
→ References rewritten to Blob URLs
→ Rewritten HTML injected into sandboxed iframe
→ iframe renders the page — links, styles, and scripts resolve correctly
```

### 10.2 iframe Sandbox Settings

The iframe `sandbox` attribute restricts what student code can do:
- `allow-scripts` — JavaScript execution permitted
- `allow-same-origin` — required for Blob URL resolution
- No `allow-forms`, `allow-top-navigation`, `allow-popups` — restricted for classroom safety

---

## 11. Sandbox Mode

A freeform coding state the teacher can activate at any point during a session. No task, no explainer, no checks, no progress tracking.

### 11.1 Entering Sandbox

```
Teacher clicks "Sandbox" button
→ Session state set to "sandbox"
→ All student editors clear immediately
→ Student's current task code / files saved to localStorage before clearing
→ Students see plain editor with no explainer or progress dots
→ Students can type and run freely
```

### 11.2 Pushing Starter Code

```
Teacher types or pastes into their editor
→ Clicks "Push to All"
→ For Python: sandboxCode written to Firebase as a string
→ For HTML: sandboxCode written as a files array matching the starterFiles format
→ sandboxCodePushedAt timestamp updated
→ All student clients detect timestamp change
→ Student editors immediately load pushed content — no prompt
→ Teacher can push again at any time — overwrites student content
```

`sandboxCodePushedAt` is used as the change trigger — ensures a repeated push of identical code still fires a change event.

### 11.3 Returning to Lesson

```
Teacher clicks "Return to Lesson"
→ state set back to "active"
→ sandboxCode and sandboxCodePushedAt cleared
→ Students snap back to currentTaskId
→ Task code / files restored from localStorage
→ Sandbox work discarded — not saved anywhere
```

### 11.4 Sandbox Student View

- Plain editor — no explainer, no progress dots, no task title
- "Sandbox" label prominent in top bar
- Python: single CodeMirror editor + output panel
- HTML: tabbed CodeMirror editor + iframe preview
- Run button active — full execution available
- `input()` supported (Python)
- Status indicators still update — teacher can see who has run
- Teacher student grid active during sandbox
- Live view and expanded view available during sandbox

---

## 12. Session Lifecycle

### 12.1 Teacher Flow

```
1. Teacher opens /lesson/:lessonId?teacher=true
2. App creates Firebase session node
   → state: "waiting", currentTaskId: 1, activeStudentView: null
   → createdAt timestamp written
3. Share Link button copies /lesson/:lessonId to clipboard
4. Teacher clicks "Start Session"
   → state: "active"
   → Waiting students released into Task 1
5. Teacher navigates tasks or activates Sandbox at any point
6. Teacher clicks "End Session"
   → state: "ended"
   → activeStudentView and sandboxCode cleared
   → All students see end-of-session screen
   → (Future: trigger proof-of-work export)
```

### 12.2 Student Flow — Returning to Same Session

```
1. Student opens /lesson/:lessonId
2. localStorage identity found — timestamps match
3. Name entry skipped — "Welcome back, Jamie!"
4. Student rejoins on current state
5. Previous code / files per task restored from localStorage
```

### 12.3 Student Flow — New Session Detected

```
1. Student opens /lesson/:lessonId
2. localStorage identity found — timestamps differ
3. Fresh anonymousId generated
4. Name entry shown
5. Name entered → suffixed if duplicate → confirmed
6. New identity written to localStorage with new lastSessionTimestamp
7. Student joins normally
```

### 12.4 Student Flow — First Ever Visit

```
1. Student opens /lesson/:lessonId
2. No localStorage identity found
3. New anonymousId generated and stored
4. Firebase checked for active session
5. If state: "waiting"  → name entry then Waiting Room
   If state: "active"   → name entry then currentTaskId
   If state: "sandbox"  → name entry then sandbox editor
   If state: "ended"    → "This session has ended"
6. Name entered → suffixed if duplicate → confirmed
7. Identity written to localStorage
```

### 12.5 Student Flow — No Active Session

```
1. Student opens /lesson/:lessonId
2. No active session found in Firebase
3. Two options:
   [Work Solo]        — solo mode immediately
   [Wait for Teacher] — waiting room
```

### 12.6 Waiting Room

- Shown when state is `"waiting"` or student chooses "Wait for Teacher"
- Lesson title shown with "Waiting for your teacher…" animation
- Option to switch to Solo Mode
- Firebase listener active — auto-advances when teacher starts session, no page refresh needed

---

## 13. Teacher View

### 13.1 Layout

```
┌─────────────────────────────────────────────────────────┐
│ Top Bar: Lesson title | Session status | Share Link btn  │
├──────────────┬──────────────────────────┬────────────────┤
│ Task Nav     │   Teacher Editor         │ Student Grid   │
│ (left panel) │   (centre panel)         │ (right panel)  │
└──────────────┴──────────────────────────┴────────────────┘
```

### 13.2 Task Navigator (left panel)

- Scrollable list of all tasks
- Task number and title per entry
- Current task highlighted
- Clicking a task advances whole class
- Aggregate status: `X students run`
- Previous / Next buttons at bottom
- **Sandbox** button — activates sandbox mode
- In sandbox: **Return to Lesson** replaces Sandbox button

### 13.3 Teacher's Own Editor (centre panel)

**Python:**
- Single CodeMirror editor — loads `starterCode`, carry-through applies
- Run button — local execution only
- Output panel beneath editor
- `input()` fully supported

**HTML/CSS/JS:**
- Tabbed CodeMirror editor — one tab per file in `starterFiles`
- Run button — renders into local iframe preview beneath editor
- In sandbox mode: **Push to All** button beneath editor

Both lesson types:
- Explainer rendered above editor in lesson mode
- Auto-indentation and autocomplete active
- Teacher uses this for screen-share demonstration

### 13.4 Student Grid (right panel)

- Dynamic grid — renders all students present
- Soft recommended maximum of 12 for UI comfort — no hard cap enforced
- Active during lesson mode and sandbox mode
- Each card:
  - Display name + pencil rename icon
  - Status: ⚪ Not run / 🟢 Success / 🔴 Error
  - ✅ Check passed badge (lesson mode, tasks with checks only)
  - Last run output truncated to ~3 lines (Python) or small iframe thumbnail (HTML)
  - Current code truncated, syntax-highlighted, read-only (Python) or active file preview (HTML)
  - Expand button

### 13.5 Expanded Student View

**Default (no live streaming):**
- Python: last-run `currentCode` in read-only editor, `currentOutput` in output panel
- HTML: last-run `currentFiles` in tabbed read-only editor, iframe rendered from last run files

**Go Live:**
- One-time fetch loads current state immediately — no blank state
- `activeStudentView` set
- Python: code mirror updates per keystroke, output streams line by line during run
- HTML: code mirror updates per keystroke per active tab, iframe re-renders on Run only
- Button changes to **Stop Live**

Closing the expanded view by any means clears `activeStudentView` automatically.

---

## 14. Student View — Live Session

### 14.1 Layout — Python Lesson Mode

```
┌──────────────────────────────────────────────────────┐
│ Top Bar: Lesson title | Task progress dots | Name     │
├──────────────────────────────────────────────────────┤
│ Explainer panel — rendered Markdown (collapsible)    │
├──────────────────────────────────────────────────────┤
│ CodeMirror editor                                    │
├──────────────────────────────────────────────────────┤
│ [Run] button                                         │
├──────────────────────────────────────────────────────┤
│ Output panel (input field appears here for input())  │
└──────────────────────────────────────────────────────┘
```

### 14.2 Layout — HTML/CSS/JS Lesson Mode

```
┌──────────────────────────────────────────────────────┐
│ Top Bar: Lesson title | Task progress dots | Name     │
├──────────────────────────────────────────────────────┤
│ Explainer panel — rendered Markdown (collapsible)    │
├──────────────────────────────────────────────────────┤
│ File tabs: [index.html] [style.css] [script.js] ...  │
│ CodeMirror editor (active tab)                       │
├──────────────────────────────────────────────────────┤
│ [Run] button                                         │
├──────────────────────────────────────────────────────┤
│ iframe preview (sandboxed)                           │
└──────────────────────────────────────────────────────┘
```

### 14.3 Layout — Sandbox Mode (both lesson types)

```
┌──────────────────────────────────────────────────────┐
│ Top Bar: Lesson title | "Sandbox" label | Name        │
├──────────────────────────────────────────────────────┤
│ Editor (Python: single / HTML: tabbed)               │
├──────────────────────────────────────────────────────┤
│ [Run] button                                         │
├──────────────────────────────────────────────────────┤
│ Output panel or iframe preview                       │
└──────────────────────────────────────────────────────┘
```

### 14.4 Task Progress Dots

- One dot per task across the top bar
- Current task: filled / highlighted
- Previously visited tasks: check mark
- Future tasks: empty, not clickable in live session
- Previously visited task dots clickable — navigate back in read-only mode

### 14.5 Viewing a Previous Task

- Editor switches to read-only
- Muted red background tint applied to editor
- Banner: "You are viewing a previous task — return to current task to continue"
- "Back to Current Task" button always visible
- Run button hidden
- Output panel / iframe shows last stored state for that task

### 14.6 Task Advance (teacher-controlled)

- Firebase `currentTaskId` change detected via listener
- Current code / files saved to localStorage before switching
- New task loads — carry-through or starter code / files applied, output cleared
- If viewing previous task: snapped back with notification "Your teacher has moved to the next task"

### 14.7 Sandbox Entry (student side)

- Firebase state change to `"sandbox"` detected via listener
- Current task code / files saved to localStorage
- Editor clears immediately
- Progress dots replaced with "Sandbox" label
- Explainer hidden

### 14.8 Sandbox Code Push (student side)

- Student watches `sandboxCodePushedAt`
- On timestamp change: load `sandboxCode` immediately — no prompt
- Overwrites current editor content

### 14.9 Returning from Sandbox (student side)

- Firebase state change back to `"active"` detected
- Sandbox content discarded
- Snapped back to `currentTaskId`
- Task code / files restored from localStorage
- Progress dots and explainer return

### 14.10 Completion Check

- Triggered automatically after each run on tasks with a check
- Python: checks `currentOutput`
- HTML: checks rendered iframe document body text
- If passes: green banner "Nice work! ✅"
- Check passed written to Firebase — teacher sees ✅ on student card
- No negative feedback on failure
- Can pass on any run — re-running is fine

### 14.11 input() Handling (Python only)

- Pyodide stdin intercepted via JavaScript bridge
- Execution pauses on `input()` call
- Inline input field appears in output panel with `>` prompt
- Student types and hits Enter — execution resumes
- Multiple sequential calls handled in sequence
- During live view: prompt text written to Firebase as it appears — teacher can see student is waiting

### 14.12 Sync Behaviour

| Condition | currentCode / currentFiles | currentOutput |
|---|---|---|
| Not being watched | On run only | On run only |
| Being watched — Python | Per keystroke | Line by line during run |
| Being watched — HTML | Per keystroke in active tab | On run only (iframe re-renders on run) |

Entirely silent — no UI change on student side.

---

## 15. Solo Mode

Triggered when no live session found and student chooses "Work Solo."

| Feature | Live Session | Solo Mode |
|---|---|---|
| Task navigation | Teacher-controlled | Student self-navigates freely |
| Previous task view | Read-only, no re-run | Fully editable, re-runnable |
| Code carry-through | Active | Active |
| Sandbox mode | Teacher-activated | Not available |
| Firebase connection | Active | None |
| Waiting room | Possible | Never shown |
| Completion checks | Active | Active |
| localStorage | Active | Active |
| Name entry | Skipped if returning, fresh if new session | Not required |
| Top bar | Name + progress dots | Progress dots only |
| Keystroke sync | On-demand when watched | Never |
| Output streaming | On-demand when watched | Never |

Solo mode is designed to complement a recorded lesson. Students can work at their own pace, move forward and back freely, and re-run any task including previous ones.

---

## 16. Pyodide Integration (Python lessons only)

| Concern | Approach |
|---|---|
| Load time | ~10MB first load — loading screen with progress indicator shown |
| Subsequent loads | Cached by browser — near instant |
| Allowed imports | Full stdlib only — no pip installs in v1 |
| File I/O | Not supported — tasks must not require it |
| input() | Stdin intercepted via JavaScript bridge — pauses execution, inline input field shown |
| Error handling | All exceptions caught, displayed in output panel with red styling |
| Run status | Success if no exception raised, error if exception raised |
| Execution isolation | Fresh Pyodide context per run — no state persists between runs |
| Output streaming | stdout hook writes line by line to Firebase during live view |

---

## 17. CodeMirror Configuration

| Setting | Value |
|---|---|
| Languages | Python (`@codemirror/lang-python`), HTML (`@codemirror/lang-html`), CSS (`@codemirror/lang-css`), JavaScript (`@codemirror/lang-javascript`) |
| Theme | To be chosen at build time — clean, readable, ages 8–16 |
| Font | JetBrains Mono or similar monospace |
| Font size | 14–16px |
| Line numbers | On |
| Auto-indentation | On — newline after `:` indents automatically (Python) / tag-aware (HTML) |
| Manual indent / dedent | Tab / Shift+Tab on selected lines |
| Autocomplete | On — triggers on every keystroke, not inside comments or strings |
| Right-click copy/paste | Native browser context menu — works as expected |
| Keyboard shortcuts | Ctrl+C, Ctrl+V, Ctrl+X standard |
| Read-only toggle | Programmatic — used for previous task view and teacher's student mirrors |
| Tab size | 4 spaces (Python) / 2 spaces (HTML/CSS/JS) |
| Bracket matching | On |
| Active line highlight | On |

---

## 18. Explainer Markdown Rendering

| Syntax | Renders as |
|---|---|
| `` `code` `` | Inline code — matches CodeMirror font and theme |
| ```` ```python ... ``` ```` | Python code block — syntax highlighted |
| ```` ```html ... ``` ```` | HTML code block — syntax highlighted |
| ```` ```css ... ``` ```` | CSS code block — syntax highlighted |
| ```` ```javascript ... ``` ```` | JavaScript code block — syntax highlighted |
| `**bold**` | Bold text |
| Plain text / line breaks | Paragraphs |

Not supported: images, headings, tables, lists, links.

Renderer: `react-markdown` with `rehype-highlight` or `react-syntax-highlighter`.

---

## 19. Brand & Theming

All UI across both apps uses the Headstart Coding brand consistently. Defined as CSS custom properties in a shared root stylesheet imported by both apps.

### CSS Custom Properties

```css
:root {
  /* Colours */
  --colour-primary:         #6222CC;
  --colour-primary-dark:    #4e1aa3;
  --colour-secondary:       #FBA504;
  --colour-secondary-dark:  #e09400;
  --colour-text:            rgb(58, 59, 60);
  --colour-text-on-primary: #ffffff;
  --colour-text-on-secondary: #ffffff;

  /* Typography */
  --font-title: 'Montserrat', sans-serif;
  --font-body:  'Quicksand', sans-serif;
  --font-code:  'JetBrains Mono', monospace;

  /* Font weights */
  --font-weight-title:        700;
  --font-weight-body:         400;
  --font-weight-body-medium:  600;
}
```

### Google Fonts

```css
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@700&family=Quicksand:wght@400;600&family=JetBrains+Mono&display=swap');
```

### Typography Usage

| Element | Font | Colour |
|---|---|---|
| Page titles, section headings | Montserrat Bold | White on primary purple background |
| Task titles, card headings | Montserrat Bold | `--colour-text` or white depending on background |
| Body text, explainers, labels | Quicksand | `--colour-text` |
| Button text | Quicksand Medium | White on `--colour-secondary` |
| Code in editors | JetBrains Mono | CodeMirror theme |
| Code in explainers | JetBrains Mono | CodeMirror theme |

### Colour Application

| Element | Colour |
|---|---|
| Section backgrounds, top bars, panels | `--colour-primary` (#6222CC) |
| Primary buttons (Run, Start Session, Download) | `--colour-secondary` (#FBA504) |
| Secondary / outline buttons | `--colour-primary` with white text |
| Hover on primary buttons | `--colour-secondary-dark` (#e09400) |
| Status — success | `#22c55e` |
| Status — error | `#ef4444` |
| Status — not run | `#9ca3af` |
| Check passed | `#22c55e` |
| Read-only editor tint | `rgba(239, 68, 68, 0.08)` |
| Card backgrounds | White |
| Page background | `#f5f5f5` |

### CodeMirror Theme

Light theme complementing the purple/yellow brand:
- Editor background: `#fafafa`
- Active line highlight: `#f0eafa` (light purple tint)
- Selection: `#e9d5ff`
- Gutter background: `#f0f0f0`
- Syntax: standard light theme palette

Do not use a dark editor theme — the overall UI is light.

---

## 20. Visual Design Notes — Classroom App

- Clean, friendly aesthetic for ages 8–16
- Clear visual hierarchy: explainer → editor → output / preview
- Explainer code blocks visually consistent with editor — one visual language throughout
- Dynamic student grid — scales to number of students present
- Status indicators (⚪ 🟢 🔴 ✅) legible at small card size in teacher grid
- HTML student cards show small iframe thumbnail of last run output
- Read-only state: red tint on editor plus text banner — never ambiguous
- Sandbox mode: "Sandbox" label prominent in top bar, visually distinct from lesson mode
- Pyodide loading state: "Getting Python ready…"
- Desktop-first layout — not broken on tablets

---

## 21. Future / Stubbed Features — Classroom App

| Feature | Notes |
|---|---|
| Proof-of-work export | Firebase already stores all run data — add export UI post-v1 |
| Teacher module builder | Covered by the Lesson Builder tool — see Part 2 |
| Hint system | Progressive per-task hints the student can reveal |
| "I'm done" signal | Student flags readiness without a formal check |
| Freehand teacher notes | Live text broadcast to students mid-session |
| Python pip installs | Pyodide supports this — unlock per-lesson via JSON flag |
| Additional check types | `variable_equals`, `function_exists`, `output_matches_regex` |
| Student accounts | If Headstart scales beyond single-teacher model |

---

## 22. Open Items — Classroom App

| Item | Status |
|---|---|
| Firebase project | Teacher to create project and provide config credentials |
| CodeMirror theme | To be chosen at build time |
| First Python lesson JSON | To be authored separately |
| First HTML lesson JSON | To be authored separately |
| GitHub Pages repo structure | `/lessons/`, `/src/`, `index.html` — confirmed at build time |

---

---

# Part 2 — Lesson Builder

---

## 23. Overview

A standalone, browser-based tool for creating and editing Headstart Coding lesson JSON files. Runs entirely in the browser — no server, no login. Outputs a downloadable `.json` file ready to drop into the GitHub repo. Hosted as a separate static page in the same GitHub Pages repo. Shares the same lesson JSON format defined in Part 1.

The builder includes full code execution — Python via Pyodide and HTML/CSS/JS via sandboxed iframe — so teachers can test their tasks, verify starter code, and confirm completion checks before publishing a lesson.

---

## 24. Hosting & Access

- Hosted at `/builder` in the same GitHub Pages repo as the classroom app
- Not linked from the main student-facing app — teacher access by knowing the URL only
- No authentication — obscurity only, consistent with the classroom app's `?teacher=true` approach

---

## 25. Core Functionality

- Create a new lesson from scratch
- Edit an existing lesson by uploading its JSON file
- Add, edit, reorder, and delete tasks
- Write explainers in Markdown with a live rendered preview
- Write and test starter code with full execution — Python and HTML/CSS/JS
- Test interactive `input()` tasks
- Verify completion checks against real output
- Preview HTML/CSS/JS tasks in a sandboxed iframe
- Download the finished lesson as a `.json` file
- Validate the lesson structure before download

---

## 26. Layout

```
┌─────────────────────────────────────────────────────────┐
│ Top Bar: Headstart Lesson Builder | New | Upload | Save  │
├──────────────┬──────────────────────────────────────────┤
│ Lesson Meta  │ Task Editor                              │
│ (left panel) │ (main panel)                             │
│              │                                          │
│ Task List    │                                          │
│ (left panel) │                                          │
└──────────────┴──────────────────────────────────────────┘
```

---

## 27. Lesson Meta Panel (left panel, top)

| Field | Input type | Notes |
|---|---|---|
| Lesson ID | Text input | Slug format enforced — lowercase, hyphens only e.g. `python-intro`. Used as filename on export |
| Lesson title | Text input | Display name |
| Description | Textarea | Short summary shown on lesson entry screen |
| Lesson type | Toggle | `python` / `html` — switches task editor mode throughout the entire builder |

---

## 28. Task List (left panel, below meta)

- Scrollable list of all tasks in order
- Each entry shows: task number, task title
- Click entry to open task in main editor panel
- Drag to reorder — task IDs renumbered automatically on reorder
- **Add Task** button at bottom of list
- **Duplicate Task** button per entry
- **Delete Task** button per entry with confirmation prompt

---

## 29. Task Editor (main panel)

### 30.1 Common Fields (both lesson types)

| Field | Input type | Notes |
|---|---|---|
| Task title | Text input | Short — shown in progress tracker |
| Explainer | Markdown textarea + live preview | Split view — raw Markdown left, rendered preview right |
| Carry code from | Dropdown | Select from existing task IDs in this lesson. Blank = no carry |
| Completion check | Toggle + fields | Toggle on to reveal check type and value fields |

### 30.2 Check Fields (when completion check toggled on)

| Field | Input type | Notes |
|---|---|---|
| Check type | Dropdown | `output_contains` only in v1 |
| Check value | Text input | The string to check for |

---

### 30.3 Python Task — Additional Fields

| Field | Input type | Notes |
|---|---|---|
| Starter code | CodeMirror editor | Python syntax highlighting, same config as classroom app |

---

### 30.4 HTML/CSS/JS Task — Additional Fields

**File manager:**
- List of files defined for this task
- Each file has: filename text input, type dropdown (`html` / `css` / `javascript`), delete button
- **Add File** button
- Clicking a file opens it in the CodeMirror editor panel

**Entry file:**
- Dropdown — select which file is the iframe entry point on Run
- Defaults to `index.html` if present

**CodeMirror editor:**
- Displays the currently selected file
- Language mode switches automatically based on file type
- Same configuration as classroom app

---

## 30. Code Execution in the Builder

The builder includes full code execution so teachers can test tasks before publishing. The same execution infrastructure used in the classroom app is shared.

### 30.1 Python Execution

- Pyodide loaded in the builder on first Run — same setup as classroom app
- Loading screen shown: "Getting Python ready…"
- Subsequent loads cached by browser — near instant
- **Run** button beneath the starter code editor
- Full output panel beneath Run button — same styling as classroom app
- `input()` fully supported — inline input field appears in output panel with `>` prompt
- Teacher can test multi-step interactive tasks end to end
- Each run is a fresh execution context — no state between runs

### 30.2 HTML/CSS/JS Execution

- **Run** button beneath the file editor
- Sandboxed iframe preview beneath Run button
- Same virtual filesystem / Blob URL approach as classroom app
- Multi-file projects render correctly — links between pages and stylesheets resolve
- Teacher sees exactly what students will see when they hit Run on the starter files

### 30.3 Completion Check Verification

When the task has a completion check enabled and the teacher hits Run:
- After execution, the check is evaluated against the actual output
- **Python:** checks stdout output against `check.value`
- **HTML:** checks rendered iframe body text against `check.value`
- Result shown beneath the output panel:
  - ✅ "Check passes — students will see the completion banner" (green)
  - ⚠️ "Check does not pass with this output — review your check value" (amber)
- This is informational only — does not block saving or downloading
- Allows teacher to confirm:
  - Starter code does not accidentally pass the check immediately
  - Expected string matches actual output (spelling, casing)
  - Check value is not too strict or too loose

### 30.4 Execution Notes

- Execution in the builder is local — no Firebase involved
- Pyodide loads once per builder session and is reused across tasks
- Builder shares Pyodide loading logic with classroom app via shared module
- Builder shares iframe virtual filesystem logic with classroom app via shared module

---

## 31. Explainer Editor

- Split view — left: raw Markdown textarea, right: live rendered preview
- Preview updates as teacher types
- Rendered using same `react-markdown` + syntax highlight setup as classroom app
- Code blocks in preview use same font and theme as CodeMirror editor
- Teacher sees exactly how the explainer will appear to students

---

## 32. Validation

Before download the lesson is validated. Errors block download. Warnings allow download with confirmation.

### 32.1 Errors (block download)

| Rule | Message |
|---|---|
| Lesson ID empty | "Lesson ID is required" |
| Lesson ID invalid format | "Lesson ID must be lowercase with hyphens only" |
| Lesson title empty | "Lesson title is required" |
| No tasks | "Lesson must have at least one task" |
| Any task missing a title | "Task [n] is missing a title" |
| Any task missing an explainer | "Task [n] is missing an explainer" |
| HTML task: no files | "Task [n] has no files" |
| HTML task: no entry file resolvable | "Task [n] has no HTML file to use as entry point" |
| HTML task: duplicate filenames | "Task [n] has duplicate filenames" |
| Check value empty when check enabled | "Task [n] has a check enabled but no check value" |
| `carryCodeFrom` references non-existent task | "Task [n] references task [x] for carry-through but that task does not exist" |

### 32.2 Warnings (allow download with confirmation)

| Rule | Message |
|---|---|
| Task has no starter code / files | "Task [n] has no starter code — students will start with an empty editor" |
| `carryCodeFrom` set but no `starterCode` fallback | "Task [n] carries code from task [x] but has no fallback starter code" |
| Task has a check but it has not been tested | "Task [n] has a completion check that hasn't been tested — run the task to verify it" |

---

## 33. Export

- **Download JSON** button in top bar
- Filename: `{lessonId}.json`
- Output is the exact lesson JSON format defined in Part 1
- Task IDs renumbered sequentially on export regardless of editing order
- Pretty-printed JSON for readability

---

## 34. Import

- **Upload** button in top bar
- Accepts `.json` files only
- Validates on upload — if invalid JSON or unrecognised format, shows error and does not load
- Populates all fields from the uploaded file
- Teacher can then edit and re-download

---

## 35. Unsaved Changes

If teacher has unsaved changes and attempts to:
- Click New
- Upload a file
- Close the tab (browser `beforeunload` event)

A warning is shown: "You have unsaved changes — download your lesson first." Changes are not auto-saved — the download is the save action.

---

## 36. State Persistence

- Current lesson state saved to `localStorage` on every change
- Key: `headstart_builder_current`
- On page load: if localStorage contains an in-progress lesson, offer to restore it: "You have an unsaved lesson in progress — restore it?"
- Protects against accidental tab closes

---

## 37. Visual Design Notes — Lesson Builder

- Matches the aesthetic of the classroom app — consistent visual language
- Clean, functional, teacher-facing — slightly more dense UI than the student view is acceptable
- Split explainer view should feel like a lightweight Markdown editor
- CodeMirror instances identical in appearance to the classroom app — teacher sees exactly what students will see
- Output panel and iframe preview match classroom app styling exactly
- Check verification result shown clearly beneath output — green for pass, amber for fail
- Validation errors shown inline beneath relevant fields, not only on download attempt
- File manager for HTML tasks should feel lightweight — not overwhelming for simple single-file tasks

---

## 38. Future Features — Lesson Builder

| Feature | Notes |
|---|---|
| Direct GitHub push | Authenticate with GitHub and push lesson JSON directly to repo without manual download/upload |
| Lesson list view | Browse and open existing lessons from the repo |
| Task templates | Common task patterns as starting points e.g. "input/output task", "fix the bug task" |
| Duplicate lesson | Clone a whole lesson as a starting point for a new one |
| Multi-teacher support | If more than one teacher authors lessons |

---

## 39. Open Items — Lesson Builder

| Item | Notes |
|---|---|
| Builder URL | `/builder` — confirmed at build time |
| Shared CodeMirror config | Builder imports same CodeMirror setup as classroom app — shared module confirmed at build time |
| Shared Markdown renderer | Same `react-markdown` config used in both tools — shared module confirmed at build time |
| Shared Pyodide loader | Same Pyodide loading and execution logic — shared module confirmed at build time |
| Shared iframe virtual filesystem | Same Blob URL logic used in both tools — shared module confirmed at build time |

---

---

# Part 3 — Shared Technical Reference

---

## 40. Shared Dependencies

| Package | Purpose | Used by |
|---|---|---|
| `react` | UI framework | Both |
| `vite` | Build tool | Both |
| `@codemirror/lang-python` | Python syntax | Both |
| `@codemirror/lang-html` | HTML syntax | Both |
| `@codemirror/lang-css` | CSS syntax | Both |
| `@codemirror/lang-javascript` | JS syntax | Both |
| `react-markdown` | Markdown rendering | Both |
| `rehype-highlight` | Syntax highlighting in Markdown | Both |
| `pyodide` | In-browser Python | Both (classroom + builder) |
| `firebase` | Real-time sync | Classroom app only |

---

## 41. Shared Modules

All shared logic lives in `src/shared/` and is imported by both apps. This is critical — do not duplicate execution or rendering logic between the two apps.

| Module | Contents | Used by |
|---|---|---|
| `codemirror.js` | CodeMirror base config, language modes, theme, extensions | Both |
| `markdown.jsx` | `react-markdown` renderer with syntax highlight config | Both |
| `iframe.js` | Virtual filesystem, Blob URL generation, iframe injection | Both |
| `pyodide.js` | Pyodide loader, stdin intercept, stdout hook, run function | Both |

---

## 42. Repository Structure

```
/
├── index.html                  # Classroom app entry point
├── builder/
│   └── index.html              # Lesson builder entry point
├── lessons/
│   ├── python-intro.json
│   ├── web-intro.json
│   └── ...
├── src/
│   ├── app/                    # Classroom app source
│   │   ├── components/
│   │   ├── hooks/
│   │   └── views/
│   ├── builder/                # Lesson builder source
│   │   ├── components/
│   │   └── views/
│   └── shared/                 # Shared modules — used by both apps
│       ├── codemirror.js       # CodeMirror setup and config
│       ├── markdown.jsx        # react-markdown renderer
│       ├── iframe.js           # Virtual filesystem / Blob URL logic
│       └── pyodide.js          # Pyodide loader and execution
├── public/
├── vite.config.js
└── package.json
```

---

## 43. GitHub Pages Deployment

- Vite configured to build to `/docs` or via GitHub Actions to `gh-pages` branch
- Both the classroom app and lesson builder deploy as part of the same build
- `/lessons/` JSON files served as static assets
- Firebase config stored in environment variables — injected at build time via Vite

---

## 44. Firebase Security Rules (v1)

```json
{
  "rules": {
    "sessions": {
      "$lessonId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

v1 uses open read/write rules — security comes from obscurity of the teacher URL. Tighter rules (e.g. restricting student writes to their own node) are a post-v1 hardening task.

---

## 45. Questions Before Build

| Item | Status |
|---|---|
| Firebase project created? | Needed before build |
| Firebase config ready to share? | Needed before build |
| GitHub repo created? | Needed before build |
| Custom domain or GitHub Pages default? | Confirm before deployment |
| Dark or light CodeMirror theme? | Confirm before build |
| Headstart Coding brand colours / guidelines? | Confirm before build |
| First lesson JSON content? | Can be authored alongside build |
| Building file by file with guidance or full codebase generated? | Confirm preferred working style |
| Node.js installed locally? | Required for development |

---

*End of specification. Version 2.2. Ready for development.*
