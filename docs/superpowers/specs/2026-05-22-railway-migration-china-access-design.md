# 部署架构迁移设计规格

> **版本**: 1.0 | **日期**: 2026-05-22 | **负责人**: 产品经理

---

## 背景

当前项目（课程与考试管理器）全部部署在 Vercel：
- **前端**：纯 HTML/CSS/JS 静态文件，无构建步骤
- **后端**：5 个 Vercel Serverless Functions（Node.js）位于 `/api/` 目录

**迁移目标**：
- 前端继续部署在 Vercel（无需改动）
- 后端迁移至 Railway（Express.js 服务器包装现有 handler）
- 同时规划国内用户可访问的部署方案

---

## 当前 API 路由

| 文件 | 方法 | 功能 |
|---|---|---|
| `api/study-plan.js` | POST | 流式 AI 对话（Gemini/DeepSeek/Claude），SSE 输出 |
| `api/generate-toc.js` | POST | Gemini 从 Markdown 提取目录 JSON |
| `api/mineru-submit.js` | POST | 提交文件 URL 至 MinerU，返回 taskId |
| `api/mineru-result.js` | GET | 轮询 MinerU 任务状态，返回 Markdown |
| `api/fetch-url.js` | POST | 代理抓取外部 URL 内容 |

前端调用均为相对路径：`/api/study-plan`、`/api/mineru-submit` 等。

---

## 方案 A：Railway 后端迁移

### 架构概览

```
┌──────────────────────────────────────────────┐
│              用户浏览器                        │
│  Vercel 前端 (HTML/CSS/JS)                    │
│  window.API_BASE = "https://xxx.railway.app"  │
└─────────────────┬────────────────────────────┘
                  │ HTTPS + CORS
                  ▼
┌──────────────────────────────────────────────┐
│           Railway 后端                         │
│  Express.js + 现有 handler 函数               │
│  端口: $PORT (Railway 自动注入)               │
│  路由: /api/study-plan, /api/generate-toc...  │
└──────────────────────────────────────────────┘
```

### 关键设计决策

1. **现有 handler 零修改**：`api/*.js` 中的 `handler(req, res)` 函数直接复用，Express 路由仅做薄包装
2. **API 基地址注入**：新增 `config.js`，由 `course.html` 中 `<script>` 最先加载，设置 `window.API_BASE`
3. **CORS**：Railway 服务器需允许 Vercel 域名（`*.vercel.app` + 自定义域名）

### 文件变更

**新建文件：**
- `server/index.js` — Express 主服务器（包装 5 个 handler）
- `server/package.json` — Node.js 依赖（仅 express、cors）
- `server/Procfile` — Railway 启动命令
- `railway.json` — Railway 项目配置
- `config.js` — 前端 API 基地址配置（`window.API_BASE`）

**修改文件：**
- `course.html` — 在所有 script 之前加载 `config.js`
- `index.html` — 同上（如有直接 API 调用）
- `course.js` — 5 处 `fetch('/api/...')` 改为 `fetch(window.API_BASE + '/api/...')`
- `app.js` — 同上（如有 API 调用）

**不变文件：**
- `api/*.js` — handler 函数原封不动，仅被 `server/index.js` 引用

### 环境变量（Railway Dashboard 配置）

```
GEMINI_API_KEY=xxx
MINERU_API_KEY=xxx
DEEPSEEK_API_KEY=xxx
ANTHROPIC_API_KEY=xxx
ALLOWED_ORIGINS=https://exam-tracker.vercel.app,https://yourdomain.com
```

---

## 方案 B：国内用户访问方案

### 痛点分析

| 组件 | 国内可用性 |
|---|---|
| Vercel（`.vercel.app`）| ❌ 经常被墙 |
| Railway | ❌ 国内访问不稳定 |
| Gemini API | ❌ 完全封锁 |
| MinerU API | ⚠️ 未验证 |
| DeepSeek API | ✅ 国内可用 |

### 推荐架构：双端部署（境外 + 境内）

```
┌─────────────────────────────────────────────┐
│           境外用户                           │
│  Vercel 前端 → Railway 后端 → Gemini/MinerU  │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│           国内用户                           │
│  CDN（阿里云/腾讯云）+ 自定义域名（ICP备案）  │
│    ↓ 静态文件                               │
│  对象存储（OSS/COS）托管前端静态文件          │
│    ↓ API 调用                               │
│  阿里云函数计算 / 腾讯云 SCF（国内后端）      │
│    ↓ AI 调用                               │
│  DeepSeek API（已在 study-plan.js 预置）     │
│  通义千问 Qwen API（作为备选）               │
└─────────────────────────────────────────────┘
```

### 国内方案技术栈

| 组件 | 境外 | 国内替代 |
|---|---|---|
| 前端托管 | Vercel | 阿里云 OSS + CDN / 腾讯云 COS + CDN |
| 后端运行时 | Railway (Express) | 阿里云函数计算 FC / 腾讯云 SCF |
| 主 AI | Gemini 2.5 Flash | DeepSeek（已预置）/ 通义千问 |
| PDF 解析 | MinerU | MinerU（需验证）/ 阿里云文档智能 |
| 文件临时存储 | litterbox.catbox.moe | 阿里云 OSS 临时签名 URL |
| 域名 | xxx.vercel.app | ICP 备案域名（必须） |

### 国内后端复用策略

国内函数计算平台均支持 Node.js 运行时。`api/*.js` 中的 handler 函数可以：
- 直接部署为阿里云 FC HTTP 触发器函数
- 或打包为腾讯云 SCF HTTP 函数

AI provider 切换：`study-plan.js` 中已有 `provider` 字段路由，只需在前端 `config.js` 中将默认 provider 设为 `deepseek`，并在国内后端配置 `DEEPSEEK_API_KEY`。

---

## 实施优先级

| 阶段 | 内容 | 优先级 |
|---|---|---|
| Phase 1 | Railway 后端迁移（Express 封装 + 前端 config.js）| 高 — 立即执行 |
| Phase 2 | 国内前端 CDN（阿里云 OSS + CDN，ICP 域名）| 中 — 需 ICP 备案 |
| Phase 3 | 国内后端（阿里云 FC + DeepSeek API）| 中 — 需开通云服务 |
| Phase 4 | 国内 PDF 解析替代（MinerU 可用性验证 → 阿里云文档智能）| 低 |

---

## 成功标准

- [ ] Railway 后端独立部署，5 个 API 路由均可通过健康检查
- [ ] 前端通过 `window.API_BASE` 正确路由到 Railway
- [ ] CORS 正确配置，无跨域错误
- [ ] 国内用户通过 CDN + ICP 域名可访问前端静态文件
- [ ] 国内 AI 功能通过 DeepSeek 正常工作
