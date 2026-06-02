# EXA-7 Technical Report

Date: 2026-06-02

## Scope

调整课程页 AI 提问框行为：

- 取消 Enter 快捷提交，恢复 textarea 默认换行。
- 生成中允许用户暂停模型输出。
- 暂停后自动把上一条输入恢复到输入框，方便用户修改后重新提交。

## Implementation

- `course.js`
  - 删除 `aiChatInput` 的 `keydown` Enter 提交监听。
  - 新增 `aiLastPrompt`，在每次发送前保存当前 prompt。
  - 新增 `setAISendButtonState()`，根据 `aiStreaming` 在发送和暂停状态间切换按钮。
  - 新增 `pauseAIStreaming()`，复用现有 `AbortController.abort()` 中断 `/api/study-plan` 流式请求。
  - 在 `AbortError` 分支中移除本次未完成的用户消息和 AI 占位消息，恢复 `aiLastPrompt` 到输入框并聚焦。
- `course.html` / `strings.js`
  - 移除 Enter 发送提示，改为点击发送按钮提交。
  - 增加 `sendAI` / `pauseAI` 三语按钮可访问文案。
- `course.css`
  - 增加暂停状态按钮样式。
- `tests/p6-p8-regression.test.js`
  - 增加静态回归测试覆盖默认 Enter 行为、点击发送文案、暂停中断和 prompt 恢复路径。

## Verification

- `node --test tests/p6-p8-regression.test.js`
- `node --test tests/*.test.js`
- `node tests/demo-tour-verification.js`
- `node --check course.js`
- `node --check strings.js`
- `git diff --check`
