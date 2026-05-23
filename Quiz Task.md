# Extension Spec: Global Quiz Tasks
## v1.2 — Headstart Coding Platform Extension

---
## 1. Overview
The **Quiz Task Module** introduces a lightweight, globally available task type (`"taskType": "quiz"`) that can be injected into any lesson (Python, HTML, Scratch, or purely digital literacy). It replaces the standard CodeMirror or Scratch workspace with a multiple-choice interface.

This module leverages the existing Firebase Realtime Database architecture to sync student answers to the teacher's dashboard instantly.

---
## 2. Quiz Task JSON Specification

To implement a quiz, the Task object in the lesson JSON is extended with `taskType`, `options`, and a specific `check` configuration.

### 2.1 Example: Hardware Quiz
```json
{
  "id": 4,
  "taskType": "quiz",
  "title": "Hardware Check",
  "explainer": "Based on what we just learned, which component acts as the 'brain' of the computer?",
  "options": [
    { "id": "a", "text": "Hard Drive (Storage)" },
    { "id": "b", "text": "CPU (Central Processing Unit)" },
    { "id": "c", "text": "RAM (Random Access Memory)" },
    { "id": "d", "text": "Motherboard" }
  ],
  "check": {
    "type": "answer_equals",
    "value": "b"
  }
}
```
## 3. UI/UX Implementation (Classroom App)

### 3.1 Student View (Quiz Mode)

When the React app mounts a task with `"taskType": "quiz"`:
1. **Hide the Editor:** The center panel drops the CodeMirror instance or Scratch VM.
2. **Render Options:** The `options` array is mapped to large, clickable, accessible buttons stacked vertically.
3. **Selection State:** When a student clicks an option, the button styling updates to indicate the active selection (e.g., filled brand color).
4. **Submit/Check:** The standard 'Run' button is replaced with a 'Submit Answer' button.

### 3.2 Teacher View (Live Sync)

The Teacher's Student Grid currently shows last-run snapshot output. For quiz tasks:

1. **Firebase Payload:** Instead of pushing `currentCode`, the student client pushes `currentAnswer: "b"`.
    
2. **Grid Update:** The teacher's grid displays the selected option text directly on the student card.
    
3. **Validation Badge:** If `currentAnswer` matches the `check.value`, the standard ✅ badge appears instantly on the teacher's screen.
    

## 4. Firebase Data Model Updates

The `students` node in the session will accommodate answers alongside code states to prevent structural breaking changes:

```JSON
"students": {
  "{anonymousId}": {
    "displayName": "Jamie",
    "currentCode": "print('hello')", // Retained for code tasks
    "currentAnswer": "b",             // NEW: Populated during quiz tasks
    "checkPassed": true,
    "lastRunAt": 1234567890
  }
}
```

## 5. Lesson Builder Integration

To allow teachers to author these quizzes without manually writing JSON, the standalone **Lesson Builder** app must be updated to support the `"quiz"` task type.

### 5.1 Task Editor Panel Updates

When a teacher adds a new task in the builder, they must be able to define it as a quiz:
- **Task Type Toggle:** A new dropdown or toggle at the top of the Task Editor to select the format: `Code/Scratch` (default) vs. `Quiz`.
- **Options Builder:** If `Quiz` is selected, the CodeMirror editor is hidden. In its place, an "Options Builder" UI mounts:
    - A dynamic list of text inputs for the options.
    - **Add Option** and **Remove Option** buttons.
    - The app automatically assigns sequential IDs (`a`, `b`, `c`, `d`) to the options as they are added.
- **Correct Answer Selection:** Next to each option input, a radio button allows the teacher to mark it as the correct answer. Selecting this automatically generates the `check` object (`"type": "answer_equals", "value": "{selected_id}"`).
### 5.2 Live Preview & Testing

The Lesson Builder's execution/preview panel must be updated to support testing quizzes:
- **Render `<QuizTask />`:** Instead of showing Pyodide output or an iframe, the preview panel renders the actual student-facing multiple-choice UI.
- **Test Validation:** The teacher can click an option and hit "Submit Answer". The builder evaluates the check logic and displays the standard check verification result beneath it (✅ _Pass_ or ⚠️ _Fail_), allowing the teacher to confirm they selected the right answer.
### 5.3 Export Validation Rules
The builder must validate quiz tasks before allowing the teacher to download the JSON:
- **Error:** "Task [n] is a quiz but has fewer than 2 options." (Blocks download)
- **Error:** "Task [n] is a quiz but has an empty option text field." (Blocks download)
- **Error:** "Task [n] is a quiz but no correct answer has been selected." (Blocks download)
## 6. Development Roadmap for Quiz Module

1. **Extend JSON Parser:** Update the classroom app's lesson loader to parse and validate `taskType: "quiz"`.
2. **Classroom App UI:** Build the `<QuizTask />` component and update the `<TaskRenderer />` router.
3. **Firebase Sync Hook:** Intercept quiz submissions and map them to `currentAnswer` in the database.
4. **Teacher Grid Update:** Add conditional logic to student cards to display `currentAnswer` during quiz tasks.
5. **Builder UI:** Add the Options Builder and correct-answer radio selectors to the Lesson Builder Task Editor.
6. **Builder Preview:** Update the Lesson Builder to render the `<QuizTask />` preview and evaluate the `answer_equals` check.
7. **Builder Validation:** Implement the pre-download validation rules for quiz tasks.