# CODEBASE_MAP.md

One-line role for every source file. Update this file when files are added, moved, or removed.

Referenced from AGENTS.md. Use this for navigation before opening files.

---

## Entry Points

| File | Role |
|---|---|
| `src/main.jsx` | Classroom app DOM entry — renders App into #root |
| `src/App.jsx` | Classroom router (HashRouter): `/lesson/:lessonId` and fallback to LandingPage |
| `src/index.css` | Global styles: brand CSS custom properties, button variants, status dots, animations, syntax highlight overrides |
| `src/builder/main.jsx` | Lesson builder DOM entry |
| `src/builder/App.jsx` | Builder root: lesson lifecycle, localStorage auto-save, lesson type chooser, restore/save dialogs |

---

## Classroom Views (`src/app/views/`)

| File | Role |
|---|---|
| `LandingPage.jsx` | Entry screen: student types lesson ID to navigate to `/lesson/:lessonId` |
| `LessonRoute.jsx` | URL dispatcher: reads `:lessonId` + query params, routes to TeacherView or StudentView |
| `StudentView.jsx` | Main student experience: all phases (loading → waiting → name-entry → lesson/sandbox/solo → ended) |
| `TeacherView.jsx` | Teacher dashboard: collapsible 3-panel layout, session lifecycle controls, student grid |

---

## Classroom Components (`src/app/components/`)

| File | Role |
|---|---|
| `TopBar.jsx` | Header: lesson title, level badge, SOLO/LIVE/SANDBOX badge, student name, progress dots slot |
| `TaskNavigator.jsx` | Left sidebar: task list with group collapse, run/check stats, sandbox and pause controls |
| `TaskProgressDots.jsx` | Top bar progress indicator: clickable past dots, locked future dots, current highlighted |
| `ExplainerPanel.jsx` | Collapsible Markdown explainer panel above the editor |
| `PythonEditor.jsx` | Python CodeEditor wrapper with Pyodide loading/error status |
| `OutputPanel.jsx` | Python output with retro typing animation and inline `input()` prompt |
| `HtmlEditor.jsx` | Tabbed HTML/CSS/JS editor with optional asset browser drawer |
| `IframePreview.jsx` | Sandboxed iframe output with console log capture tab (receives postMessage from iframe) |
| `CollapsibleIframePreview.jsx` | Slide-in toggle wrapper around IframePreview |
| `ScratchWorkspace.jsx` | Full Scratch IDE: multi-sprite Blockly workspaces, stage canvas, sprite drag, check evaluation |
| `QuizTask.jsx` | Polymorphic quiz: multiple-choice (grid), match (drag-drop), fill-blank (drag/type), short-answer |
| `CheckFeedbackBanner.jsx` | Pass/fail banner with optional hint and "see complete code" action |
| `WaitingRoom.jsx` | Full-screen modal: lesson title + animated "your teacher is getting ready" message |
| `JoinChoiceScreen.jsx` | Choice screen: Wait for Teacher or Work Solo (shown when no active session) |
| `JoinSessionPrompt.jsx` | Modal: option to join a live session that started during solo work |
| `NameEntry.jsx` | Student name input with duplicate-suffix handling and solo fallback |
| `StudentGrid.jsx` | Grid of StudentCards with collapse toggle and check conditions display |
| `StudentCard.jsx` | Compact card: name, online/run/check badges, code/output/quiz snippet, expand button |
| `StudentModal.jsx` | Full-width modal: student workspace view + teacher actions (Go Live, Remote Reset, Rename, Remove) |

---

## Classroom Hooks (`src/app/hooks/`)

| File | Role |
|---|---|
| `useIdentity.js` | Anonymous ID and display name management; localStorage persistence; session timestamp comparison |
| `useSession.js` | Firebase session listener and full command layer: session lifecycle, student sync, sandbox, teacherLive, remote reset |

---

## Builder Views (`src/builder/views/`)

| File | Role |
|---|---|
| `BuilderView.jsx` | Main builder layout: 3-pane (meta / task list / editor), validation, CRUD, download/upload |
| `PreviewView.jsx` | Preview mode: wraps StudentView read-only so teacher can test the student experience |

---

## Builder Components (`src/builder/components/`)

| File | Role |
|---|---|
| `LessonMetaPanel.jsx` | Lesson-level metadata: id, type, title, description, level, assets, sandbox config modals |
| `TaskList.jsx` | Left sidebar: task/group tree with drag-reorder, selection, creation, validation summary |
| `TaskEditor.jsx` | Monolithic task editor (all task types, quiz builders, check editors, sprite/backdrop managers, Scratch starter/complete tabs) |
| `ExplainerEditor.jsx` | Markdown editor with Edit/Preview tabs; live rendering via MarkdownRenderer |
| `FileManager.jsx` | HTML file list: add/delete/type-change, entry file picker, HTML+CSS+JS template generator |
| `BuilderOutputPanel.jsx` | Output panel with check results, retro typing animation, and `input()` prompt for builder |

---

## Shared Modules (`src/shared/`)

| File | Role |
|---|---|
| `CodeEditor.jsx` | Shared CodeMirror React wrapper: language/readOnly via compartments, no remount on prop change |
| `SplitPane.jsx` | Draggable two-pane splitter: [15%, 85%] clamped, collapsible right pane with fixed width option |
| `AssetBrowser.jsx` | Read-only lesson asset browser: file tree, click-to-copy paths, image hover preview |
| `checks.js` | Check evaluation engine: `evaluateCheckResults()`, `evaluateSingleCheck()`, `CHECK_TYPES` constants |
| `codemirror.js` | CodeMirror config: `headstartTheme`, `headstartHighlight`, `createBaseExtensions(type, readOnly)`, `getTabSize(type)` |
| `firebase.js` | Firebase app init from Vite env vars; exports `db` (Realtime Database reference) |
| `iframe.js` | `buildIframeSrc()`: Blob URL filesystem, cross-reference rewriting, CSP + console interceptor injection |
| `markdown.jsx` | Markdown renderer: tables, callouts, fenced code blocks, Scratch block pills, `InlineMarkdown` |
| `pyodide.js` | Pyodide Web Worker manager: `initPyodide()`, `runPython()`, `stopPython()`, `provideInput()`, `isPyodideReady()` |
| `pyodide.worker.js` | Web Worker: Pyodide loader, AST-based async `input()` transform, stdout/stderr event streaming |
| `scratch.js` | Custom Scratch interpreter: 62 block definitions, multi-sprite state, broadcast, sounds, check evaluation |
| `taskUtils.js` | `flattenTasks()`, `getProgressItems()`, `updateSubtaskTitles()` — group/subtask management |
| `useIsMobile.js` | `useIsMobile(breakpoint=640) → boolean` — media query hook for responsive layout |

---

## Lesson Files

| Path | Role |
|---|---|
| `lessons/` | Static JSON lesson files — add new lessons here; referenced by ID in URLs |

---

## Config & Build

| File | Role |
|---|---|
| `vite.config.js` | Vite build config for both classroom and builder apps |
| `package.json` | Dependencies and scripts |
| `index.html` | Classroom app HTML shell |
| `builder/index.html` | Lesson builder HTML shell |
