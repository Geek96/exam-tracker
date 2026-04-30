# Textbook Markdown Retrieval Design

## Goal
Replace full-file AI context injection with local textbook-aware retrieval: split converted Markdown into course-specific chunks, retrieve relevant chunks for each user question, and send only those snippets to the AI.

## Scope
- Apply to Markdown course materials stored in IndexedDB.
- First version uses deterministic local retrieval, not embeddings.
- Prioritize textbook queries that mention chapter, section, exercise, problem, or question numbers.
- Keep full-file context only as a fallback for very small documents or no chunks.

## Chunking Rules
- Parse Markdown headings `#` through `######` and preserve a `headingPath` metadata array.
- Detect textbook identifiers in headings and nearby text:
  - chapters: `Chapter 3`, `第 3 章`
  - sections: `3.4`, `Section 3.4`, `§3.4`, `第 3.4 节`
  - exercises/problems: `Exercise 3`, `Problem 3`, `第 3 题`, `习题 3`
- Keep math blocks (`$$...$$`) and fenced code blocks intact while splitting.
- Target chunk size: about 4,000 characters. Hard maximum: about 8,000 characters.
- Overlap adjacent overflow chunks by about 400 characters.

## Retrieval Rules
- Extract query hints from the user question: section number, problem/exercise number, and keywords.
- Rank chunks by:
  1. section number match
  2. exercise/problem number match
  3. heading text match
  4. content keyword match
  5. recency/order proximity when scores tie
- Return top 6 chunks with source metadata.
- If no chunk scores meaningfully, return no context and make the prompt say the selected course materials did not contain a matching snippet.

## Prompt Shape
Every free-form AI message should call the retrieval layer. The API-only payload includes:
- user question
- `课程资料检索片段` section containing numbered snippets
- each snippet includes file name, heading path, section number, item number if detected

Conversation history continues storing only display/user text, not large retrieved content.

## Data Storage
- Add IndexedDB object store `materialChunks` to `examTrackerFiles`.
- Store chunk records keyed by `id`, including `courseId`, `fileId`, `fileName`, `headingPath`, `sectionNo`, `itemNo`, `content`, `chunkIndex`, and `updatedAt`.
- Generate chunks when saving Markdown materials and when rendering materials detects a Markdown file without chunks.
- Delete chunks when deleting the source material.

## Testing
- Static regression tests verify functions and API path wiring.
- Unit-style Node tests validate pure chunking and retrieval functions by extracting them from a browser-safe helper file.
