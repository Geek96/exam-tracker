# Course & Exam Manager

> Helps students manage course chapter progress, upload textbook materials, and use an AI assistant for study planning and Q&A.

**Live Demo**: [Your Vercel deployment URL]
**Video Demo**: [Your YouTube link]
**Tech Stack**: HTML · CSS · Vanilla JS · Vercel Serverless Functions (Node.js)
**AI Engines**: Google Gemini · Anthropic Claude · DeepSeek · MinerU (PDF parsing)

---

## Features

| Feature | Status |
|---|---|
| Course management (create/edit/delete, color tags, exam countdown) | ✅ |
| Exam management (add exams with name, date, type; home-screen reminders) | ✅ |
| Chapter/section tracking with completion checkboxes and progress bar | ✅ |
| PDF bookmark auto-import for chapter lists | ✅ |
| MinerU AI-powered TOC extraction (for PDFs without bookmarks) | ✅ |
| Manual chapter add/edit | ✅ |
| Course material uploads (PDF / Markdown / HTML) | ✅ |
| PDF → Markdown conversion via MinerU (auto-splits PDFs > 199 pages) | ✅ |
| AI study assistant with real-time streaming (Gemini / Claude / DeepSeek) | ✅ |
| Provider-aware RAG: Gemini receives full document; others receive the exact section | ✅ |
| Section-level material retrieval (`extractSectionFromMarkdown`) | ✅ |
| Multi-session conversation history (IndexedDB) | ✅ |
| Save AI responses as Markdown materials with KaTeX / LaTeX preview | ✅ |
| Trilingual UI (Chinese / English / Spanish) | ✅ |
| Guided 10-step demo tour with pre-seeded Linear Algebra course | ✅ |
| LaTeX math rendering (KaTeX auto-render) | ✅ |

---

## Project Overview

Course & Exam Manager is a browser-based study tool for university students. The core problem it solves: students need to track progress across multiple courses, manage exam deadlines, and get AI help with specific textbook problems — all in one place.

The app runs entirely in the browser with **no build step**. All JavaScript files are loaded directly by the browser. The backend is three lightweight Vercel Serverless Functions that act as secure proxies to external AI APIs (so API keys are never exposed to the client).

When a student asks the AI "solve problem 3 in section 3.4," the app automatically locates section 3.4 in the uploaded textbook Markdown and injects the full section content into the AI prompt — no manual copy-pasting required.

---

## Setup and Installation

### Prerequisites

- A modern browser (Chrome, Firefox, Safari, Edge)
- [Vercel CLI](https://vercel.com/docs/cli) for local API testing (optional)
- API keys for Gemini and MinerU (see below)

### Running Locally (static UI only)

No installation needed. Open `index.html` directly in your browser to use the app without AI features.

### Running Locally (with AI features)

```bash
# Install Vercel CLI
npm i -g vercel

# Link to your Vercel project (first time only)
vercel link

# Pull environment variables from Vercel Dashboard
vercel env pull .env.local

# Start local dev server (serves HTML + Serverless Functions)
vercel dev
```

Then open `http://localhost:3000` in your browser.

### Environment Variables

Set these in the Vercel Dashboard under **Settings → Environment Variables**:

| Variable | Where to get it |
|---|---|
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com) |
| `MINERU_API_KEY` | [MinerU website](https://mineru.net) — register for a free key |
| `DEEPSEEK_API_KEY` | [DeepSeek Platform](https://platform.deepseek.com) (optional) |

### Deployment

The project auto-deploys to Vercel on every push to the `main` branch via GitHub Actions. No manual deploy step needed.

---

## How to Use

1. **Open the app** — on first visit you will be prompted to select a language (Chinese / English / Spanish)
2. **Try the demo** — a Linear Algebra demo course is pre-loaded; follow the 10-step guided tour
3. **Add a course** — click "Add Course," enter a name and color
4. **Add an exam** — inside a course, add upcoming exams; they appear on the home screen sorted by date
5. **Import chapters** — upload a PDF to auto-extract its bookmark structure, or add chapters manually
6. **Upload materials** — upload a PDF or Markdown file; the app converts PDF to Markdown via MinerU
7. **Chat with AI** — ask questions about the course material; the AI reads your uploaded Markdown files automatically
8. **Save AI responses** — click the save icon on any AI reply to store it as a Markdown file with LaTeX rendering

---

## Project Structure

```
exam-tracker/
├── index.html              # Home page: course grid + upcoming exams reminder
├── course.html             # Course detail: chapters, exams, materials, AI chat
├── welcome.html            # New-user language selection and onboarding
├── app.js                  # Home page logic (course CRUD, exam reminders)
├── course.js               # Course page logic (~2800 lines)
├── material-rag.js         # RAG module: Markdown chunking, section extraction, retrieval
├── strings.js              # i18n key-value store — window.t() / window.tf()
├── styles.css              # Global styles (dark purple Holo theme, CSS variables)
├── course.css              # Course page styles
├── welcome.css             # Welcome page styles
├── api/
│   ├── study-plan.js       # Serverless: streams AI responses (Gemini / Claude / DeepSeek)
│   ├── generate-toc.js     # Serverless: Gemini extracts TOC JSON from Markdown
│   ├── mineru-submit.js    # Serverless: submits PDF URL to MinerU, returns taskId
│   └── mineru-result.js    # Serverless: polls MinerU task status, returns Markdown
├── tests/
│   └── material-rag.test.js  # 18 automated tests for the RAG module (Node.js test runner)
├── docs/
│   └── superpowers/
│       ├── specs/          # Design documents
│       └── plans/          # Implementation plans
├── report/
│   └── HW14_filled.md      # HW14 project report
├── .agents/
│   └── AGENT_GUIDELINES.md # AI agent behavior guidelines for this project
├── STATUS.md               # Live project status board
└── ROADMAP.md              # Feature roadmap and completed milestones
```

---

## Running Tests

```bash
node --test tests/material-rag.test.js
```

Expected output: 18 tests passing, 0 failing. Tests cover:
- Markdown chunk extraction and heading path detection
- Section number detection from queries (including Chinese numerals)
- Exercise item detection and scoring
- Section-level content extraction (`extractSectionFromMarkdown`)
- Edge cases: equation/figure reference disambiguation, TOC heading disambiguation

---

## Technologies Used

| Technology | Version | Purpose |
|---|---|---|
| Vanilla JS / HTML / CSS | — | Core application (no framework, no build step) |
| Vercel Serverless Functions | Node.js 20 | Secure API proxy for AI services |
| Google Gemini API | gemini-2.5-flash | Primary AI assistant + TOC generation |
| Anthropic Claude API | claude-sonnet-4-6 | Alternative AI assistant |
| MinerU API | — | PDF → Markdown conversion |
| pdf.js | 3.11.174 | Client-side PDF bookmark extraction |
| pdf-lib | 1.17.1 | Client-side PDF splitting (> 199 pages) |
| KaTeX | 0.16.11 | LaTeX math formula rendering |
| marked.js | 9.1.6 | Markdown → HTML rendering |
| IndexedDB | Browser native | File storage, chat history, RAG chunk index |

---

## Author

Daniel — Personal Programming Project (HW14)
Virginia Tech, Spring 2026
