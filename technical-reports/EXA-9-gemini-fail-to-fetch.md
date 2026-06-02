# EXA-9 Gemini AI 提问 `Failed to fetch` 技术报告

**日期**: 2026-06-02  
**操作者**: 高级程序员1 / Codex (GPT-5)

## 问题

用户在 AI 提问功能中选择 Gemini 时，页面显示网络错误 `Failed to fetch`。

## 根因判断

Gemini 对话接口位于 `api/study-plan.js`，前端通过 `fetch('/api/study-plan')` 消费 SSE 流。Provider-aware 上下文策略下，Gemini 会收到整本 Markdown 教材内容，首包等待时间可能明显变长。

原实现存在两个稳定性缺口：

1. `vercel.json` 只为 `api/upload-tmpfile.js` 配置了 `maxDuration: 60`，没有为 `api/study-plan.js` 配置函数时长。
2. `api/study-plan.js` 只调用 `gemini-3-flash-preview`，没有 timeout，也没有在开始写 SSE 前执行模型降级。

当上游连接或首 token 生成慢于平台默认函数时长时，Vercel 会终止函数。浏览器端不会收到结构化错误，只会得到网络层 `Failed to fetch`。

## 修复

- 在 `vercel.json` 为 `api/study-plan.js` 配置 `maxDuration: 60`。
- 在 `api/study-plan.js` 新增 `GEMINI_MODELS`：
  - `gemini-3-flash-preview`
  - `gemini-2.5-flash`
- 新增 `callGeminiStream()`，对 Gemini 上游流式请求设置 `AbortSignal.timeout(45000)`。
- `handleGemini()` 在开始向浏览器写入 SSE 之前依次尝试模型链；全部失败时返回汇总后的 502 JSON 错误。

## 验证

新增并运行回归测试：

```bash
node --test tests/p6-p8-regression.test.js
```

测试覆盖：

- `api/study-plan.js` 存在 Gemini fallback 模型链。
- Gemini 上游请求存在 45s timeout。
- `vercel.json` 为 `api/study-plan.js` 配置 60s 函数时长。

## 风险

如果 Gemini 流已经开始后中途断开，当前实现仍只能通过 SSE `{ err }` 事件透传错误，不能在同一响应中切换模型。此次修复重点覆盖最常见的 `Failed to fetch` 来源：函数平台提前终止和上游首包等待无边界。
