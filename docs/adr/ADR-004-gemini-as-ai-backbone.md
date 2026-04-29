# ADR-004: 使用 Google Gemini 作为 AI 主干

**日期**: 2026-04-28  
**状态**: 已接受

## 背景

需要两类 AI 能力：
1. 流式对话（学习助手）
2. 结构化 JSON 生成（章节目录提取）

## 决策

使用 Google Gemini API（`generativelanguage.googleapis.com`），默认模型为 `gemini-3-flash-preview`，回退至 `gemini-2.5-flash`。

## 理由

- **大上下文窗口**：Gemini Flash 支持 1M token，可读取完整课本 Markdown（120K chars/文件，总 300K）
- **免费额度**：Gemini Flash 有充足的免费配额
- **SSE 原生支持**：`?alt=sse` 参数即可获得标准 SSE 流，前端直接用 `fetch` + `ReadableStream` 消费
- **JSON 强制输出**：`responseMimeType: 'application/json'` 保证 TOC 生成可靠解析

## 模型链（回退顺序）

```
gemini-3-flash-preview  →  gemini-2.5-flash
```

每个模型最多重试 2 次（处理 503/429 限流），全部失败时返回汇总错误信息。

## Claude 作为备选

AI 对话面板提供 Gemini/Claude 切换按钮（UI 已实现，Claude 后端待接入）。  
参见 ROADMAP 中"Claude API 对话支持"条目。
