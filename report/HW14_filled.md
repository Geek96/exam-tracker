# Personal Programming Project Report

---

## Title

**Course & Exam Manager: An AI-Powered Study Assistant Web Application**

---

## (5pts) Honor Code and LLM Usage for this Report

I affirm that this report reflects my own work and thinking. Large Language Models (specifically Claude Sonnet 4.6 via Claude Code CLI) were used as a development assistant throughout this project for code generation, debugging, architecture planning, and generating this report's content. All design decisions, feature specifications, and acceptance criteria were determined by me. See the Consultation and LLM Usage section for full details.

---

## (15pts) Learning Objectives

**Objective 1 — Build and deploy a full-stack web application without a traditional build toolchain**

*Met.* I successfully built and deployed a fully functional multi-page web application using only HTML, CSS, and Vanilla JavaScript — no webpack, no Vite, no npm packages loaded in the browser. The backend consists of Vercel Serverless Functions (Node.js) that serve as a thin proxy to external AI APIs. I learned that disciplined use of browser-native APIs (Fetch, IndexedDB, TextDecoder, ArrayBuffer) can replace most of what a framework provides. The biggest surprise was how capable modern browsers are: I implemented features like streaming SSE, client-side PDF splitting with pdf-lib (via CDN), and LaTeX rendering with KaTeX — all without a build step.

**Objective 2 — Integrate multiple LLM APIs with real-time streaming output**

*Met.* I integrated three AI providers: Google Gemini (primary, streaming via SSE), Anthropic Claude (streaming, claude-sonnet-4-6), and DeepSeek (pre-wired, pending API key). Each provider uses a different SDK and authentication pattern. The streaming implementation required correctly parsing `data:` SSE chunks, handling mid-stream errors, and rendering partial Markdown in real time. I learned that provider APIs diverge significantly in how they structure streamed tokens, and that a model fallback chain (gemini-3-flash-preview → gemini-2.5-flash → 2.0-flash) is essential for reliability.

**Objective 3 — Implement efficient browser-side data persistence using IndexedDB**

*Met.* The application stores course metadata in localStorage, file blobs (PDFs, Markdown) in IndexedDB (`examTrackerFiles`), chat session history in a second IndexedDB (`examTrackerChatSessions`), and the RAG chunk index in a third IndexedDB (`examTrackerMaterialChunks`). Isolating each data domain into its own database prevented database version conflicts from blocking unrelated features — a hard-learned lesson after a critical bug where upgrading the files database blocked AI session reads. I also implemented a cache-busting `INDEX_VERSION` constant so that stale chunk indexes are automatically rebuilt when the chunking algorithm changes.

**Objective 4 — Build a Retrieval-Augmented Generation (RAG) system in pure client-side JavaScript**

*Partially met, then superseded.* I built a rule-based chunking and retrieval system that splits Markdown textbooks by heading, detects section numbers and exercise item numbers via regex, scores chunks against user queries, and injects relevant excerpts into AI prompts. This worked for simple cases but proved brittle across textbooks with different structural conventions (e.g., `# Exercises` as a top-level heading clears the section context). I ultimately supplemented it with a simpler and more robust provider-aware strategy: send the entire matching section's Markdown content to non-Gemini models, and the full document to Gemini (which has a 1M token context). I learned that elegant rule-based systems often require more edge-case handling than a cruder-but-reliable fallback.

**Objective 5 — Design a multilingual user interface supporting Chinese, English, and Spanish**

*Met.* All UI text is routed through a centralized `strings.js` key-value store using `window.t(key)` and `window.tf(key, vars)` for variable interpolation. HTML static text uses `data-i18n` attributes processed by `applyStrings()` on load and language switch. The application covers approximately 130 string keys across all three languages. I learned that deferring i18n to a late stage creates significant rework; structuring the string system from the first commit would have saved several hours.

---

## (15pts) Timeline

| Time | Task | Expected Details from Proposal | Actual Details |
|---|---|---|---|
| Hour 1–2 | Research and gather resources | Survey Vercel Serverless Functions, Gemini API docs, IndexedDB patterns | Set up GitHub repository, configured Vercel auto-deploy via GitHub Actions CI, studied Gemini streaming API documentation. Identified that a no-build-step constraint ruled out React/Vue and locked in the Vanilla JS + CDN-library approach. Made early decision to use Vercel Serverless for API key security rather than calling LLMs directly from the browser. |
| Hour 3–4 | Design the project structure and plan | Sketch HTML page layout, define data model for courses and chapters | Built the initial exam tracker: course CRUD with localStorage, chapter/section list with checkboxes, PDF bookmark import using pdf.js. Also applied the glassmorphism / holographic purple UI aesthetic that defines the visual identity. The two-column layout (chapter list + AI chat panel) was designed to let students reference material while chatting with the AI — a key UX decision. |
| Hour 5–6 | Start coding the basic functionalities | Implement core course page features | Integrated Claude API and Gemini API with a provider toggle. Built SSE streaming rendering: partial Markdown chunks rendered in real time as tokens arrive. Added MinerU integration: upload PDF to a temporary CDN (litterbox.catbox.moe), submit URL to MinerU for PDF-to-Markdown conversion, poll for results. This was the most complex API orchestration in the project. |
| Hour 7–8 | Test and debug the initial version | Test AI chat, fix session persistence bugs | Hit a critical bug: AI responses were overwriting course data in localStorage due to a shared storage namespace. Fixed by separating AI session history into its own IndexedDB. Also added exam management module (CRUD for exams with date, name, type), migrated conversation history to IndexedDB, and implemented the upcoming exams widget on the home page. |
| Hour 9–10 | Refine and add advanced features | Polish UI, add multilingual support | Built the Markdown RAG system: chunk textbooks by heading/exercise, score chunks against user queries, inject relevant excerpts into AI prompts. Added a 10-step guided demo tour with a pre-seeded Linear Algebra course and two sample Markdown files to help first-time users explore all features. Completed the i18n system across all three languages. |
| Additional | Provider-aware context + RAG hardening | — | Spent additional time fixing RAG edge cases (section number pollution from equation references, Chinese numeral query normalization, TOC heading disambiguation). Ultimately replaced fine-grained chunk scoring with a simpler and more robust architecture: `extractSectionFromMarkdown` sends the entire matching section to the AI, with Gemini receiving the full document (leveraging its 1M token context window at $0.013/query). |

---

## (55pts) Final Product Description

### Minimum Viable Product (MVP)

A browser-based course management app where students can:
- Create, edit, and delete courses with color labels
- Import chapter/section lists from PDF bookmarks or add them manually
- Mark chapters as complete and track overall progress per course
- Add exam dates with name and type (midterm, final, quiz, etc.)
- View upcoming exams sorted by date on the home page

### Target Product

Everything in MVP, plus:
- Upload PDF or HTML course materials; convert them to Markdown via MinerU AI (supports PDFs > 199 pages via automatic client-side splitting)
- Chat with an AI study assistant (Gemini) that can read uploaded Markdown materials
- Save AI responses as Markdown files for future reference, rendered with KaTeX for LaTeX formulas
- Multi-session conversation history stored in IndexedDB
- Full internationalization in Chinese, English, and Spanish
- A guided 10-step demo tour for new users

### Reach Version

Everything in Target, plus:
- **RAG-based material retrieval**: When a student asks "solve problem 3 in section 3.4," the system automatically extracts and injects the exact section content from the textbook into the AI prompt, rather than sending the whole document
- **Provider-aware context strategy**: Gemini receives the full textbook (leveraging its 1M token context); Claude and DeepSeek receive only the relevant section to stay within their context limits and control cost
- **Multi-provider AI**: Claude Sonnet 4.6 and DeepSeek V3 as selectable alternatives to Gemini
- **18 automated tests** for the RAG module covering section extraction, query normalization, chunk scoring, and edge cases

### (20pts) Description of Final Product

Course & Exam Manager is a web application for university students who juggle multiple courses and need to track study progress alongside AI-assisted learning. The target user is a student with uploaded PDF textbooks who wants to ask specific questions about exercise problems without manually pasting text. The core problem: existing AI chat tools have no awareness of a student's actual textbook content or exam schedule. This app connects both. Key features include: PDF-to-Markdown conversion via the MinerU API, a provider-aware RAG system that extracts relevant textbook sections before each AI query, multi-session conversation history, and exam deadline tracking with home-screen reminders. Technically, the app runs entirely in the browser with no build step; persistence uses IndexedDB for files and chat history; the backend consists of three Vercel Serverless Functions that proxy to Gemini, MinerU, and Claude APIs. Deployed at Vercel with automatic CD from GitHub main.

### (20pts) Video Demonstration

*(Record and upload a 1–2 minute narrated demo to YouTube, then paste the link here.)*

**YouTube Link:** [TO BE ADDED AFTER RECORDING]

Suggested demo flow (≈90 seconds):
1. Show home page with upcoming exams widget (10s)
2. Enter the Linear Algebra demo course, show the chapter checklist (10s)
3. Open Materials tab, show a Markdown file, open it with KaTeX preview (10s)
4. Switch to AI Chat, ask "Solve section 3.4 problem 3" — show the section content being injected and the AI answer streaming in (30s)
5. Switch the AI provider from Gemini to Claude, show the provider toggle (10s)
6. Save the AI response as a material, open it to show Markdown + LaTeX render (10s)
7. Show the welcome page and language switcher (10s)

### (15pts) File List and Repository Structure

```
exam-tracker/
├── index.html              # Home page: course grid + upcoming exams
├── course.html             # Course detail page: chapters, exams, materials, AI chat
├── welcome.html            # New-user onboarding and language selection
├── app.js                  # Home page logic (course CRUD, exam reminders)
├── course.js               # Course page logic (~2800 lines: chapters, AI chat, materials)
├── material-rag.js         # RAG module: Markdown chunking, section extraction, retrieval
├── strings.js              # i18n key-value store for zh/en/es
├── styles.css              # Global styles (dark purple Holo theme, CSS variables)
├── course.css              # Course page-specific styles
├── api/
│   ├── study-plan.js       # Serverless: streams AI responses (Gemini/Claude/DeepSeek)
│   ├── generate-toc.js     # Serverless: Gemini extracts TOC JSON from Markdown
│   ├── mineru-submit.js    # Serverless: submits PDF URL to MinerU, returns taskId
│   └── mineru-result.js    # Serverless: polls MinerU task, returns Markdown
├── tests/
│   └── material-rag.test.js # 18 Node.js test runner tests for the RAG module
├── docs/
│   ├── superpowers/specs/  # Design documents
│   └── superpowers/plans/  # Implementation plans
├── .agents/
│   └── AGENT_GUIDELINES.md # AI agent behavior constitution for this project
├── STATUS.md               # Live project status board
├── ROADMAP.md              # Feature roadmap and milestones
└── README.md               # Setup and deployment instructions
```

**Live deployment:** [Your Vercel URL here]

---

## (10pts) Consultation and Use of LLMs

### Consultation Description

This project was developed independently without direct peer consultation. Architecture decisions (no-build-step constraint, three-IndexedDB data isolation strategy, provider-aware RAG) were made through iterative self-evaluation: implementing a feature, observing its failure modes in the browser, and redesigning. I referenced official documentation for the Gemini Streaming API, MinerU API, Vercel Serverless Functions, and the IndexedDB specification. The Vercel deployment model (auto-deploy from GitHub main, environment variables in Dashboard) was learned from official Vercel docs.

### Use of LLMs

I used **Claude Sonnet 4.6 via the Claude Code CLI** as my primary development assistant across the entire project. The collaboration was structured and iterative:

- **Architecture planning**: I described feature requirements in natural language; Claude proposed 2–3 implementation approaches with trade-offs; I selected and refined the approach before Claude wrote any code.
- **Code generation**: Claude generated implementations for individual functions and modules (e.g., `chunkMarkdownMaterial`, `extractSectionFromMarkdown`, the SSE streaming renderer) based on precise specs I wrote.
- **Debugging**: For complex bugs (e.g., the IndexedDB version conflict that blocked AI sessions after a file database upgrade), I used a systematic debugging skill that required identifying root cause before any fix was attempted. Claude traced the failure to a shared IndexedDB name collision.
- **Test writing**: Claude wrote unit tests after I specified the expected behavior for each case. All 18 tests in `material-rag.test.js` were written with Claude.
- **Design review**: Claude served as a code reviewer, catching edge cases I missed — for example, that `extractSectionFromMarkdown` could false-match on headings containing section numbers in prose (e.g., `## Covers equation 3.4`) and not just at the heading start.
- **Documentation**: This report was drafted with Claude's assistance based on the actual project artifacts (git log, STATUS.md, ROADMAP.md, source files).

The LLM was not given open-ended mandates. Every feature started with me specifying what I wanted, why, and what constraints applied. Claude's role was to accelerate implementation and catch errors — the product direction was mine throughout.
