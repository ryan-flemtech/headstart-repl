# Codebase Improvement Suggestions

## Scope

This plan is intentionally limited to maintainability, clarity, styling consistency, and developer tooling. It should not change application behaviour, Firebase data structures, localStorage key formats, lesson JSON output, URLs, or student/teacher workflows.

Baseline observed on 26 May 2026:

- `npm test` passes: 15 test files, 247 tests.
- `npm test` reports non-failing Vite/plugin deprecation warnings and repeated Node `--localstorage-file` warnings.
- The largest implementation files are `src/builder/components/TaskEditor.jsx` (approximately 3,937 lines), `src/app/views/StudentView.jsx` (approximately 1,752 lines), `src/app/components/ScratchWorkspace.jsx` (approximately 1,153 lines), `src/shared/scratch.js` (more than 1,200 lines), `src/builder/views/BuilderView.jsx` (approximately 930 lines), and `src/app/views/TeacherView.jsx` (approximately 914 lines).

## Progress Update — PR #66

Implemented on 26 May 2026 in [`feature/implement-suggestions`](https://github.com/Headstart-Coding-Launchpad/editor/pull/66):

- Refreshed `CODEBASE_MAP.md` and `TESTING.md`, including missing source files, current covered components, and a convention to consider those inventories when adding source/test targets.
- Extracted builder validation and export normalisation from `BuilderView.jsx` into `src/builder/lessonUtils.js`, with characterization tests for lesson types, grouped tasks, checks, carry-through, and export cleanup.
- Added shared `src/shared/assetPaths.js` and replaced repeated `resolveAssetsPath` implementations across classroom and builder code.
- Added shared `src/shared/workspaceData.js` for identical scratch-state/file-data helpers, then migrated `TeacherView.jsx` and `StudentModal.jsx`.
- Extracted student localStorage persistence helpers into `src/app/studentStorage.js`, with tests explicitly protecting established key formats.
- Extracted teacher student-live payload construction into `src/app/teacherLivePayload.js`, preserving current task/file selection behaviour and adding tests.
- Removed test-run noise: `npm test` now runs without the React/Vite deprecation messages or Node `--localstorage-file` warnings.
- Expanded the unit suite from 15 files / 247 tests to 20 files / 263 tests. `npm run build` also passes.

Still to do:

- Continue decomposing `StudentView.jsx` beyond its extracted storage and task-content helpers, particularly narrowly scoped live/session helpers.
- Further reduce `TeacherView.jsx` orchestration density through any remaining stable presentational boundaries.
- Separate `ScratchWorkspace.jsx` presentation concerns and gradually split stable categories in `src/shared/scratch.js`, backed by characterization tests.
- Move repeated static inline styling into existing CSS classes and standardise already-equivalent presentational primitives.
- Add focused component coverage for view states and boundary calls before making deeper `StudentView` or `TeacherView` changes.

## Progress Update - PR #73

Implemented on 26 May 2026 in [`refactor/split-task-editor`](https://github.com/Headstart-Coding-Launchpad/editor/pull/73):

- Split `TaskEditor.jsx` into focused task-editor sub-modules for fields, quiz editors, check editors, Scratch editors, and shared styles.
- Preserved top-level `TaskEditor.jsx` exports used by existing builder callers.
- Added characterization tests for check type/operator mappings, check skeleton construction, and Scratch toolbox XML parsing.
- Updated `CODEBASE_MAP.md` for the extracted task-editor directory.

## Progress Update - PR #74

Implemented on 26 May 2026 in [`codex/refactor-teacher-sandbox-content`](https://github.com/Headstart-Coding-Launchpad/editor/pull/74):

- Extracted sandbox starter/configured/live content selection from `TeacherView.jsx` into pure `src/app/teacherSandboxContent.js` helpers.
- Added characterization coverage for Python, HTML, and Scratch sandbox precedence and defensive cloning/parsing.
- Updated `CODEBASE_MAP.md` and `TESTING.md` for the new helper and tests.

## Progress Update - PR #75

Implemented on 26 May 2026 in [`codex/refactor-teacher-presentation-controls`](https://github.com/Headstart-Coding-Launchpad/editor/pull/75):

- Extracted teacher task navigation, presentation/share links, and session actions into `TeacherSessionControls`.
- Moved its static popover/control styling into the established CSS layer.
- Added focused component coverage for navigation, share callbacks, and state-specific actions.

## Progress Update — PR #101

Implemented on 27 May 2026 in [`refactor/teacher-code-tabs`](https://github.com/Headstart-Coding-Launchpad/editor/pull/101):

- Extracted the inline `TeacherCodeTabs` function from `TeacherView.jsx` into `src/app/components/TeacherCodeTabs.jsx`.
- Removed dead inline style props that were fully overridden by existing `ui-tabs`/`ui-tab` CSS `!important` rules.
- Added 8 characterization tests covering tab rendering, `aria-selected` state, stage iteration, and Send-to-all visibility.
- Updated `CODEBASE_MAP.md` for the new component.

## Progress Update — PR #102

Implemented on 27 May 2026 in [`refactor/teacher-banners`](https://github.com/Headstart-Coding-Launchpad/editor/pull/102):

- Extracted preview-mode and sandbox banners from `TeacherView.jsx` into `src/app/components/TeacherPreviewBanner.jsx` and `src/app/components/TeacherSandboxBanner.jsx`.
- Moved banner static styling into CSS classes (`.teacher-preview-banner`, `.teacher-sandbox-banner`, button modifiers, `btn--warn` variant) in `src/index.css`.
- Added 13 characterization tests covering banner text, conditional button visibility, and all callback props.
- Updated `CODEBASE_MAP.md` for the two new components.

## Progress Update — PR #103

Implemented on 27 May 2026 in [`refactor/teacher-end-session-modal-and-quiz-suggestion`](https://github.com/Headstart-Coding-Launchpad/editor/pull/103):

- Extracted the end-session confirmation modal from `TeacherView.jsx` into `src/app/components/TeacherEndSessionModal.jsx`.
- Moved modal static styling into CSS classes (`.teacher-end-modal__overlay`, `.teacher-end-modal`, title/body/actions/button modifiers) in `src/index.css`.
- Removed the now-empty `overlay`/`modal`/`modalTitle`/`modalBody`/`modalActions` keys from `TeacherView`'s `s` style object; also removed the dead `taskTitleHeader` key.
- Extracted the inline `getQuizSuggestion` function from `StudentView.jsx` into the new pure helper module `src/app/studentQuizContent.js`, following the established pattern of `studentStorage.js`, `studentTaskContent.js`, and `studentLiveDisplay.js`.
- Added 5 component tests for `TeacherEndSessionModal` (heading, Cancel/End/End+Home callbacks, overlay click).
- Added 12 unit tests for `getQuizSuggestion` covering null/undefined task, option feedback/hint fallback, task-level feedback, check hint fallback, short-answer check evaluation, match/fill-blank types, and missing-quizType default.
- Updated `CODEBASE_MAP.md` for the two new files.
- Suite expanded from 29 files / 322 tests (pre-PR #101) to 32 files / 357 tests.

## Progress Update - PR #76

Implemented on 26 May 2026 in [`refactor/student-task-content`](https://github.com/Headstart-Coding-Launchpad/editor/pull/76):

- Extracted StudentView task-content precedence into `src/app/studentTaskContent.js` for Python, HTML, and Scratch content selection.
- Added characterization coverage for solo restore, carry-through, starter fallback, and the existing standalone-task carry behaviour.
- Updated maintenance inventories while leaving session effects, Firebase writes, localStorage keys, and lesson output unchanged.

## Progress Update - PR #107

Implemented on 27 May 2026 in [`refactor/add-characterization-tests`](https://github.com/Headstart-Coding-Launchpad/editor/pull/107):

- Added focused component coverage for six previously untested classroom components: `WaitingRoom`, `JoinChoiceScreen`, `JoinSessionPrompt`, `NameEntry`, `ExplainerPanel`, and `TopBar`.
- `NameEntry` tests cover unique name submission, whitespace trimming, duplicate-suffix confirmation flow, multiple-suffix stepping, solo link, and waiting-room mode.
- `ExplainerPanel` tests cover collapsible toggle, `aria-expanded` state, non-collapsible mode, and content delegation to `MarkdownRenderer`.
- `TopBar` tests cover Solo/Live/Sandbox badge selection rules, `displayName` visibility, right-slot rendering, and desktop-mode branding.
- Updated `TESTING.md` component coverage inventory.
- Expanded test suite from 30 files / 340 tests to 36 files / 395 tests.

<<<<<<< HEAD
## Progress Update - PR #107

Implemented on 27 May 2026 in [`refactor/add-characterization-tests`](https://github.com/Headstart-Coding-Launchpad/editor/pull/107):

- Added focused component coverage for six previously untested classroom components: `WaitingRoom`, `JoinChoiceScreen`, `JoinSessionPrompt`, `NameEntry`, `ExplainerPanel`, and `TopBar`.
- `NameEntry` tests cover unique name submission, whitespace trimming, duplicate-suffix confirmation flow, multiple-suffix stepping, solo link, and waiting-room mode.
- `ExplainerPanel` tests cover collapsible toggle, `aria-expanded` state, non-collapsible mode, and content delegation to `MarkdownRenderer`.
- `TopBar` tests cover Solo/Live/Sandbox badge selection rules, `displayName` visibility, right-slot rendering, and desktop-mode branding.
- Updated `TESTING.md` component coverage inventory.
- Expanded test suite from 30 files / 340 tests to 36 files / 395 tests.
=======
## Progress Update — PR #101

Implemented on 27 May 2026 in [`refactor/teacher-code-tabs-component`](https://github.com/Headstart-Coding-Launchpad/editor/pull/101):

- Extracted the inline `TeacherCodeTabs` function from `TeacherView.jsx` into `src/app/components/TeacherCodeTabs.jsx`.
- Removed redundant inline styles on tab elements (`s.codeTabStrip`, `s.codeTabBtn`, `s.codeTabBtnActive`) — these were already overridden by the `ui-tabs--editor` / `ui-tab` / `aria-selected` CSS rules (all carrying `!important`); only the uncovered `tabActions` and `sendStageBtn` styles remain as local constants.
- Added 8 characterization tests covering tab rendering, stage delegation, complete-tab visibility, and the `window.confirm`-gated send-to-all flow.
- Updated `CODEBASE_MAP.md`.
>>>>>>> refactor/teacher-code-tabs-component

## Guiding Rules

- Preserve current public props, exports, lesson JSON shape, Firebase paths, and localStorage keys during refactors.
- Move one responsibility at a time and keep each change reviewable.
- Add characterization tests before moving logic with user-facing or persistence effects.
- Prefer existing shared-module and CSS patterns over introducing libraries or a new styling system.
- Keep Scratch, Pyodide, iframe, Firebase, checks, and Markdown logic shared rather than duplicating it.

## Priority 1: Low-Risk Foundations

### 1. Refresh the codebase map and maintenance documentation

**Evidence:** `CODEBASE_MAP.md` does not currently list source files including `src/shared/AssetImagePreview.jsx`, `src/app/components/InformationTask.jsx`, and `src/app/components/CollapsiblePanelControls.jsx`. `TESTING.md` also describes some areas as untested although tests now exist for items such as `QuizTask`, `InformationTask`, and `TeacherTimers`.

**Suggested work:**

- Update `CODEBASE_MAP.md` to match the present file tree.
- Update `TESTING.md` coverage/test inventory to match existing tests.
- Add a short convention that any new source component or test requires the map/inventory to be considered in the same pull request.

**Why first:** It makes later refactor work easier to navigate and review, with documentation-only risk.

### 2. Extract and test pure builder logic

**Evidence:** `src/builder/views/BuilderView.jsx` contains pure lesson validation and export-normalisation functions near the top of a rendering/controller component: `validateLesson`, `quizHasStarter`, `quizHasCheckValue`, and `normalizeTasksForExport`.

**Suggested work:**

- Move pure validation and export-normalisation functions into a builder utility module, for example `src/builder/lessonValidation.js` and/or `src/builder/lessonExport.js`.
- Add unit tests that capture the current messages and exported JSON for Python, HTML, Scratch, quiz, information, grouped task, carry-through, and check variants.
- Leave `BuilderView` responsible only for view state, selection, handlers, and rendering.

**Benefit:** High clarity gain with a small behavioural surface because the extracted logic is already pure.

### 3. Centralise repeated asset-path and lightweight data helpers

**Evidence:** The same `resolveAssetsPath` implementation appears in `StudentView.jsx`, `TeacherView.jsx`, `StudentModal.jsx`, `TaskEditor.jsx`, and twice within `LessonMetaPanel.jsx`. Scratch-state parsing/cloning and HTML file typing/decoding are also implemented locally in teacher/modal code.

**Suggested work:**

- Add a small shared asset URL utility and replace copies without changing its output.
- Consolidate scratch-state parse/clone helpers where they are identical.
- Consider a shared file-list conversion helper for decoded Firebase HTML files, retaining `encodeFileKey`/`decodeFileKey` ownership and exact encoding behaviour.
- Unit-test representative inputs before replacing call sites, especially paths containing spaces or nested folders.

**Benefit:** Removes copy-paste maintenance risk from code that is used by both the classroom and builder.

## Priority 2: Break Up Large Modules Along Existing Responsibilities

### 4. Split `TaskEditor.jsx` into task-type editor modules

**Evidence:** `src/builder/components/TaskEditor.jsx` is nearly 4,000 lines and already contains clear internal clusters: quiz editors, check-list editors, Scratch toolbox/check editors, sprite/backdrop managers, modal/workspace tabs, carry-through controls, and the main task editor.

**Suggested work:**

- Extract existing internal components without redesigning their props or state flow.
- Suggested destinations:
  - `src/builder/components/task-editor/QuizEditors.jsx`
  - `src/builder/components/task-editor/CheckEditors.jsx`
  - `src/builder/components/task-editor/ScratchEditors.jsx`
  - `src/builder/components/task-editor/TaskEditorFields.jsx`
- Keep the top-level `TaskEditor` as the composition point and retain current exports initially to avoid import churn.
- Add focused component/unit tests for extracted pure mapping utilities such as check type/operator conversions and Scratch toolbox parsing.

**Benefit:** Makes task-specific changes much safer to review without altering the builder interface.

### 5. Decompose `StudentView.jsx` by state responsibility

**Evidence:** `StudentView.jsx` combines lesson loading, identity/session joining, local persistence, live publishing, task content loading, Python/HTML/Scratch execution, quiz submission, presentation mode, and layout. It currently has approximately 26 `useState` calls, 17 effects, and 14 exhaustive-dependency suppressions.

**Suggested work:**

- First extract pure/local helpers: storage key construction and saved-work reads/writes, task-content selection, and teacher-live payload construction.
- Next isolate narrowly scoped hooks only where behaviour can be characterized, such as saved student work or teacher-live publishing.
- Leave phase transitions and session coordination in `StudentView` until the smaller pieces are tested.
- Replace dependency suppressions only when the refactor can prove identical timing and write behaviour; do not "clean up" effects by guesswork.

**Benefit:** Reduces the riskiest view's cognitive load while respecting its delicate persistence/live-stream rules.

### 6. Separate `ScratchWorkspace` presentation from Scratch runtime utilities

**Evidence:** `src/app/components/ScratchWorkspace.jsx` combines canvas drawing, hit testing, thumbnails, workspace lifecycle, sprite controls, run controls, keyboard handling, and layout. `src/shared/scratch.js` separately combines block definitions, toolbox manipulation, execution, input/sound/backdrop runtime, geometry, persistence, and check evaluation.

**Suggested work:**

- In `ScratchWorkspace`, extract canvas rendering and sprite-control subcomponents/helpers first.
- In `src/shared/scratch.js`, split stable categories such as definitions/toolbox, interpreter runtime, and check/state utilities while retaining the existing barrel exports.
- Use existing `src/shared/__tests__/scratch.test.js` as a base for characterization coverage before moving runtime functions.

**Benefit:** Makes Scratch work approachable without adding a second implementation of the runtime.

### 7. Reduce teacher-view orchestration density

**Evidence:** `TeacherView.jsx` mixes sandbox starter selection, draft cloning, student-live payload formation, share/presentation links, session actions, and large render sections.

**Suggested work:**

- Extract sandbox content selection utilities and student-live payload construction as pure functions.
- Use existing `findTaskById` from `src/shared/taskUtils.js` consistently rather than repeating flattened-task searches where appropriate.
- Extract the share/presentation controls and sandbox action strip into presentational components after their inputs are stable.

**Benefit:** Easier maintenance of teacher controls while keeping all Firebase writes in the existing hook.

## Priority 3: Styling Consistency Without a Visual Redesign

### 8. Move repeated static inline styles into the established CSS layer

**Evidence:** The app already has shared classes and tokens in `src/index.css` (`btn-*`, `ui-tabs`, `ui-collapsible`, presence badges, timers), but UI components still contain a large volume of style objects. Notable counts include approximately 275 `style=` uses in `TaskEditor.jsx`, 58 in `ScratchWorkspace.jsx`, 57 in `TeacherView.jsx`, and 53 in `StudentView.jsx`.

**Suggested work:**

- Keep truly dynamic measurements/coordinates inline, such as preview positioning, pane sizes, and runtime colours.
- Move repeated static visual patterns into named classes, starting with builder form fields, modal shells, action bars, badges, tabs, and empty/status panels.
- Extend existing CSS custom properties for repeated neutral borders, text colours, spacing, and panel backgrounds rather than introducing another styling mechanism.
- Perform this incrementally per component and use screenshots or browser checks to prove no visual drift.

**Benefit:** Smaller JSX files, easier hover/focus/responsive styling, and more consistent visual maintenance.

### 9. Standardise shared presentational primitives

**Evidence:** Components use overlapping concepts such as collapsible panel controls, output/status panels, modal shells, editor tabs, copy actions, and asset previews. Some shared pieces already exist (`CollapsiblePanelControls`, `SplitPane`, `AssetImagePreview`), but usage is not yet consistently reflected across the surrounding views.

**Suggested work:**

- Inventory repeated UI structures before extracting anything new.
- Reuse current primitives where markup and interaction are already equivalent.
- Extract only stateless/presentational wrappers whose behaviour is identical, leaving run/session logic in owning components.

**Benefit:** Improves consistency without creating a generic component library that is harder to understand than the duplication.

## Priority 4: Tooling and Refactor Guardrails

### 10. Resolve current test-run warnings

**Evidence:** The passing `npm test` run emits Vite/plugin deprecation warnings about `esbuild` and `optimizeDeps.esbuildOptions`, plus repeated Node warnings about an invalid `--localstorage-file` path.

**Suggested work:**

- Identify whether the Vite/plugin warning comes from current dependency compatibility or local configuration before changing versions.
- Identify where the Node localStorage option is set and correct the test environment invocation/configuration.
- Keep dependency upgrades separate and request approval before adding packages or making major-version changes.

**Benefit:** Keeps a clean baseline so future warnings point to real issues.

### 11. Add characterization coverage around refactor targets

**Evidence:** Existing tests cover shared utilities and several components, while the largest orchestration files remain difficult to refactor confidently.

**Suggested work:**

- Prioritise tests for exported or extracted pure functions rather than testing implementation detail.
- Before changing `StudentView` or `TeacherView`, add focused component coverage for important rendered states and mocked boundary calls that the refactor touches.
- For builder extraction, test validation and JSON normalization directly rather than relying only on end-to-end flows.
- Keep Firebase, Pyodide, CodeMirror, and Scratch canvas boundaries mocked according to `TESTING.md`.

**Benefit:** Enables structural improvements while explicitly guarding unchanged behaviour.

## Recommended Sequence

Completed in PR #66:

1. Refreshed `CODEBASE_MAP.md` and `TESTING.md`.
2. Added characterization tests and extracted builder validation/export helpers.
3. Extracted shared asset URL and lightweight workspace-data helpers.
4. Extracted first pure helpers from `TeacherView.jsx` and `StudentView.jsx`.
5. Investigated and removed test-run warnings.

Remaining sequence:

1. ✅ Consolidate static styling for builder components moved during the TaskEditor split. (PR #104)
2. ✅ Continue pure/helper and presentational extraction from `TeacherView.jsx`, then `StudentView.jsx`. (PRs #101–#103, #105)
3. ✅ Refactor Scratch presentation/runtime modules in small, test-backed pieces. (PR #106)
4. ✅ Add further characterization coverage alongside each structural change. (PR #107)

## Explicit Non-Goals

- No backend, authentication, Firebase schema, or live-write-rule changes.
- No changes to anonymous identity or localStorage key formats.
- No new dependency or styling framework by default.
- No alterations to lesson JSON schema/exported content.
- No broad effect rewrites in session/live code without tests that capture current behaviour.
