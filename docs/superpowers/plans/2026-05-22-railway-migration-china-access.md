# 部署架构迁移：Railway 后端 + 国内访问方案 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将后端 API 从 Vercel Serverless Functions 迁移至 Railway（Express.js），前端继续部署在 Vercel，并提供完整的国内用户访问方案。

**Architecture:** Express.js 服务器封装现有 5 个 `api/*.js` handler 函数（零修改），通过新增 `config.js` 让前端动态切换 API 基地址。国内方案采用阿里云 OSS/CDN 托管前端 + 阿里云函数计算托管后端（复用同一批 handler）+ DeepSeek 替代 Gemini。

**Tech Stack:** Node.js 18+, Express 4.x, cors middleware, Railway.app, 阿里云 OSS / CDN / 函数计算, DeepSeek API

---

## 文件结构

```
exam-tracker/
├── api/                         # 现有 handler — 不做任何改动
│   ├── fetch-url.js
│   ├── generate-toc.js
│   ├── mineru-result.js
│   ├── mineru-submit.js
│   └── study-plan.js
├── server/                      # 新建：Railway 后端
│   ├── index.js                 # Express 主入口，注册所有路由
│   └── package.json             # 仅 express + cors 依赖
├── railway.json                 # 新建：Railway 部署配置
├── config.js                    # 新建：前端 API 基地址（window.API_BASE）
├── course.html                  # 修改：最先加载 config.js
├── index.html                   # 修改：最先加载 config.js（如需）
└── course.js                    # 修改：5 处 /api/ 调用加上 window.API_BASE 前缀
```

---

## Task 1：创建 Express 后端入口

**Files:**
- Create: `server/package.json`
- Create: `server/index.js`
- Create: `railway.json`

- [ ] **Step 1: 创建 `server/package.json`**

```json
{
  "name": "exam-tracker-server",
  "version": "1.0.0",
  "description": "Express backend for exam-tracker (Railway deployment)",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "dev": "node index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5"
  },
  "engines": {
    "node": ">=18"
  }
}
```

- [ ] **Step 2: 安装依赖**

```bash
cd server && npm install && cd ..
```

Expected: 生成 `server/node_modules/` 和 `server/package-lock.json`

- [ ] **Step 3: 创建 `server/index.js`**

```js
'use strict';
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// CORS：允许 Vercel 前端及本地开发访问
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // 允许无 Origin 头（curl、Postman）以及配置白名单中的域名
    if (!origin || allowedOrigins.includes(origin) ||
        /\.vercel\.app$/.test(origin) || origin === 'http://localhost:5500') {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS: ' + origin));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10mb' }));

// 健康检查
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));

// 动态加载 api/*.js handler
const handlers = ['fetch-url', 'generate-toc', 'mineru-submit', 'mineru-result', 'study-plan'];
for (const name of handlers) {
  const handlerPath = path.join(__dirname, '..', 'api', name + '.js');
  let mod;
  try {
    mod = require(handlerPath);
  } catch (e) {
    console.warn('[WARN] Could not load handler:', name, e.message);
    continue;
  }
  const fn = mod.default || mod;
  if (typeof fn !== 'function') {
    console.warn('[WARN] Handler is not a function:', name);
    continue;
  }

  // 注册 GET + POST 以兼容 mineru-result (GET) 和其他 (POST)
  app.get('/api/' + name, fn);
  app.post('/api/' + name, fn);
  console.log('[OK] Registered /api/' + name);
}

app.listen(PORT, () => {
  console.log('Server running on port', PORT);
});
```

- [ ] **Step 4: 本地测试 Express 服务器启动**

```bash
cd server
# 临时设置环境变量（使用你的真实 key）
GEMINI_API_KEY=test MINERU_API_KEY=test ALLOWED_ORIGINS=http://localhost:5500 node index.js
```

Expected 输出：
```
[OK] Registered /api/fetch-url
[OK] Registered /api/generate-toc
[OK] Registered /api/mineru-submit
[OK] Registered /api/mineru-result
[OK] Registered /api/study-plan
Server running on port 3000
```

- [ ] **Step 5: 验证健康检查端点**

```bash
curl http://localhost:3000/health
```

Expected: `{"status":"ok","ts":1234567890}`

- [ ] **Step 6: 创建 `railway.json`（Railway 部署配置）**

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "cd server && npm install && node index.js",
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

- [ ] **Step 7: 提交**

```bash
cd /path/to/exam-tracker
git add server/package.json server/package-lock.json server/index.js railway.json
git commit -m "feat: add Express backend server for Railway deployment"
```

---

## Task 2：前端 API 基地址配置

**Files:**
- Create: `config.js`
- Modify: `course.html` — 最先加载 config.js
- Modify: `index.html` — 最先加载 config.js（如有直接 API 调用）

> **背景**：前端当前使用相对路径 `/api/...`。迁移后需改为指向 Railway 的绝对 URL。由于无构建步骤，通过一个在页面最先加载的 `config.js` 暴露 `window.API_BASE` 实现。

- [ ] **Step 1: 创建 `config.js`**

```js
// API 基地址配置
// 生产环境：将此处改为 Railway 部署后的实际 URL
// 本地开发：保持 '' 使用相对路径（需同时运行 Vercel Dev 或将 server/index.js 反向代理到 /api）
(function () {
  // 开发时改为 'http://localhost:3000'，部署后改为 Railway 地址
  window.API_BASE = window.RAILWAY_API_URL || '';
})();
```

> **注意**：`window.RAILWAY_API_URL` 是留给高级配置（如通过 meta 标签注入）的钩子。正常情况下直接将 `window.API_BASE` 的值设为 Railway URL 字符串即可，例如：
> `window.API_BASE = 'https://exam-tracker-production.up.railway.app';`

- [ ] **Step 2: 在 `course.html` 最先加载 `config.js`**

找到 `course.html` 中第一个 `<script>` 标签，在其之前插入：

```html
<!-- API 基地址配置 — 必须最先加载 -->
<script src="config.js"></script>
```

实际定位：在 `course.html` 中搜索第一个 `<script src=` 并在其上方插入上述一行。

- [ ] **Step 3: 在 `index.html` 加载 `config.js`（如有 API 调用）**

在 `index.html` 中做同样处理（如果 `index.html` 中没有任何 `fetch('/api/...')` 调用，此步可跳过）：

```html
<script src="config.js"></script>
```

- [ ] **Step 4: 更新 `course.js` 中的 5 处 API 调用**

将以下相对路径改为使用 `window.API_BASE` 前缀：

| 原始代码 | 修改后 |
|---|---|
| `fetch('/api/generate-toc', {` | `fetch((window.API_BASE || '') + '/api/generate-toc', {` |
| `fetch('/api/mineru-submit', {` | `fetch((window.API_BASE || '') + '/api/mineru-submit', {` |
| `` fetch(`/api/mineru-result?taskId=${...}`) `` | `` fetch(`${window.API_BASE || ''}/api/mineru-result?taskId=${...}`) `` |
| `fetch('/api/fetch-url', {` | `fetch((window.API_BASE || '') + '/api/fetch-url', {` |
| `fetch('/api/study-plan', {` | `fetch((window.API_BASE || '') + '/api/study-plan', {` |

精确行号（以当前代码为准，执行时请 grep 确认）：
- course.js:779 — `/api/generate-toc`
- course.js:870 — `/api/mineru-submit`
- course.js:885 — `/api/mineru-result` (第一处)
- course.js:902 — `/api/mineru-result` (第二处)
- course.js:2481 — `/api/fetch-url`
- course.js:2571 — `/api/study-plan`

执行替换：
```bash
cd /path/to/exam-tracker
# 先 grep 确认当前行号
grep -n "fetch('/api/" course.js
grep -n "fetch(\`/api/" course.js
```

然后对每处进行编辑（使用 Edit 工具，不要用 sed）。

- [ ] **Step 5: 本地验证（Live Server / python -m http.server）**

```bash
# 终端 1：启动后端
cd server
GEMINI_API_KEY=<your_key> MINERU_API_KEY=<your_key> node index.js

# 终端 2：启动前端
cd ..
python3 -m http.server 5500
```

打开 http://localhost:5500/course.html，确认控制台无 CORS 错误，AI 对话功能正常。

> 此时 `config.js` 中 `window.API_BASE = ''` 仍使用相对路径，本地测试需确保前端和后端同端口，或将 `window.API_BASE` 临时改为 `'http://localhost:3000'`。

- [ ] **Step 6: 提交**

```bash
git add config.js course.html index.html course.js
git commit -m "feat: add config.js for Railway API base URL, update all fetch calls"
```

---

## Task 3：Railway 平台部署

> **前提**：已有 Railway 账号，已安装 Railway CLI（`npm i -g @railway/cli`）或通过 Railway 网页操作。

- [ ] **Step 1: 在 Railway 控制台创建新项目**

1. 登录 https://railway.app
2. 点击 **New Project** → **Deploy from GitHub repo**
3. 选择 `exam-tracker` 仓库
4. Railway 会自动检测 `railway.json` 并使用配置

- [ ] **Step 2: 在 Railway 设置环境变量**

在项目 Settings → Variables 中添加：

```
GEMINI_API_KEY      = <your gemini key>
MINERU_API_KEY      = <your mineru key>
DEEPSEEK_API_KEY    = <your deepseek key>
ANTHROPIC_API_KEY   = <your anthropic key>
ALLOWED_ORIGINS     = https://exam-tracker.vercel.app,https://yourdomain.com
```

> `ALLOWED_ORIGINS` 填入你的 Vercel 前端域名，多个以英文逗号分隔。

- [ ] **Step 3: 等待部署完成并记录 Railway URL**

Railway 会自动生成形如 `https://exam-tracker-production.up.railway.app` 的域名。

记录此 URL，下一步使用。

- [ ] **Step 4: 验证 Railway 健康检查**

```bash
curl https://exam-tracker-production.up.railway.app/health
```

Expected: `{"status":"ok","ts":1234567890}`

- [ ] **Step 5: 用 curl 测试一个 API 端点**

```bash
curl -X POST https://exam-tracker-production.up.railway.app/api/generate-toc \
  -H "Content-Type: application/json" \
  -d '{"content":"Chapter 1\nSection 1.1\nSection 1.2","range":"第1章"}'
```

Expected: 返回 JSON，包含 `chapters` 数组（或 Gemini API 错误 — 说明 API key 已读取）。

- [ ] **Step 6: 更新 `config.js` 填入真实 Railway URL**

编辑 `config.js`：

```js
(function () {
  window.API_BASE = 'https://exam-tracker-production.up.railway.app';
})();
```

将 `exam-tracker-production.up.railway.app` 替换为你的实际 Railway 域名。

- [ ] **Step 7: 提交并推送**

```bash
git add config.js
git commit -m "chore: set Railway API URL in config.js"
git push origin main
```

Vercel 将自动重新部署前端。

- [ ] **Step 8: 端到端功能验证**

打开 Vercel 生产前端 URL，测试以下功能：
- [ ] AI 学习助手对话（调用 `/api/study-plan`）
- [ ] 章节目录 MinerU 提取（调用 `/api/mineru-submit` + `/api/mineru-result`）
- [ ] URL 内容抓取（调用 `/api/fetch-url`）
- [ ] 控制台无 CORS 错误

---

## Task 4：国内前端访问方案（阿里云 OSS + CDN）

> **前提**：拥有已 ICP 备案的域名（如 `exam.yourdomain.cn`）；已开通阿里云账号。

- [ ] **Step 1: 创建阿里云 OSS Bucket**

1. 登录阿里云控制台 → 对象存储 OSS
2. 创建 Bucket：
   - 名称：`exam-tracker-static`
   - 地域：选国内（如华东1 杭州）
   - 读写权限：**公共读**
3. 开启静态网站托管：
   - 默认首页：`index.html`
   - 默认 404 页：`index.html`

- [ ] **Step 2: 上传前端静态文件**

```bash
# 安装阿里云 CLI（如未安装）
pip install aliyun-python-sdk-core

# 或使用 ossutil
# 下载：https://help.aliyun.com/document_detail/120075.html
ossutil cp -r . oss://exam-tracker-static/ \
  --exclude "server/*" \
  --exclude "node_modules/*" \
  --exclude ".git/*" \
  --exclude "docs/*"
```

- [ ] **Step 3: 创建国内专用 `config.js`（指向国内后端）**

为国内部署准备单独的 config，上传时覆盖通用版本：

```js
(function () {
  // 国内后端 URL（阿里云函数计算，见 Task 5）
  window.API_BASE = 'https://exam-tracker-cn.your-fc-domain.cn';
})();
```

- [ ] **Step 4: 配置阿里云 CDN**

1. 控制台 → CDN → 添加加速域名
2. 加速域名：`exam.yourdomain.cn`
3. 源站类型：OSS 域名 → 选择 `exam-tracker-static.oss-cn-hangzhou.aliyuncs.com`
4. 业务类型：图片小文件
5. 开启 HTTPS（上传 SSL 证书或使用免费证书）

- [ ] **Step 5: 配置 DNS 解析**

在域名 DNS 管理处添加 CNAME 记录：
```
exam.yourdomain.cn  CNAME  xxx.alikunlun.com
```
（`xxx.alikunlun.com` 由阿里云 CDN 分配）

- [ ] **Step 6: 验证国内前端访问**

```bash
curl -I https://exam.yourdomain.cn/index.html
```

Expected: `HTTP/2 200` 且响应头包含 `x-cache: HIT`（CDN 缓存命中）

---

## Task 5：国内后端方案（阿里云函数计算 + DeepSeek）

> **前提**：已开通阿里云函数计算 FC；拥有 DeepSeek API Key。

- [ ] **Step 1: 确认 DeepSeek 已在 `api/study-plan.js` 中正确实现**

```bash
grep -n "deepseek\|handleDeepSeek\|DEEPSEEK" api/study-plan.js | head -20
```

Expected: 存在 `handleDeepSeek` 函数及 `DEEPSEEK_API_KEY` 引用。

- [ ] **Step 2: 创建国内 FC 部署包**

阿里云函数计算支持将 Express 应用部署为 HTTP 函数，使用现有 `server/index.js`。

打包：
```bash
cd server
zip -r ../fc-deploy.zip . -x "node_modules/*"
cd ..
zip -r fc-deploy.zip api/ -x "api/**/.DS_Store"
```

实际上，可以使用 Serverless Devs（阿里云官方 IaC 工具）：

```bash
npm install -g @serverless-devs/s
```

- [ ] **Step 3: 创建 `s.yaml`（Serverless Devs 配置）**

```yaml
edition: 3.0.0
name: exam-tracker-cn
access: default

vars:
  region: cn-hangzhou

resources:
  exam-tracker-backend:
    component: fc3
    props:
      region: ${vars.region}
      functionName: exam-tracker-api
      runtime: nodejs18
      code: .
      handler: server/index.handler
      memorySize: 512
      timeout: 60
      environmentVariables:
        GEMINI_API_KEY: ""         # 留空，Gemini 国内不可用
        DEEPSEEK_API_KEY: ${env.DEEPSEEK_API_KEY}
        MINERU_API_KEY: ${env.MINERU_API_KEY}
        ALLOWED_ORIGINS: "https://exam.yourdomain.cn"
      triggers:
        - triggerName: http-trigger
          triggerType: http
          qualifier: LATEST
          triggerConfig:
            authType: anonymous
            methods: [GET, POST, OPTIONS]
```

- [ ] **Step 4: 修改 `server/index.js` 支持 FC HTTP 触发器导出**

在 `server/index.js` 末尾添加（在 `app.listen` 之后）：

```js
// 阿里云函数计算 HTTP 触发器兼容
if (process.env.FC_RUNTIME_API) {
  module.exports.handler = (req, res) => app(req, res);
} else {
  app.listen(PORT, () => console.log('Server running on port', PORT));
}
```

同时将原来的 `app.listen` 包裹在条件中：

完整修改后的 `server/index.js` 结尾：

```js
if (process.env.FC_RUNTIME_API) {
  // 阿里云函数计算环境：导出 handler
  module.exports.handler = (req, res) => app(req, res);
} else {
  // 本地 / Railway 环境：直接监听端口
  app.listen(PORT, () => {
    console.log('Server running on port', PORT);
  });
}
```

- [ ] **Step 5: 部署到阿里云函数计算**

```bash
DEEPSEEK_API_KEY=<your_key> MINERU_API_KEY=<your_key> s deploy -y
```

记录输出的 HTTP 触发器 URL，形如：
`https://xxxxxxxx.cn-hangzhou.fcapp.run`

- [ ] **Step 6: 验证国内后端健康检查**

```bash
curl https://xxxxxxxx.cn-hangzhou.fcapp.run/health
```

Expected: `{"status":"ok","ts":...}`

- [ ] **Step 7: 验证 DeepSeek AI 对话**

```bash
curl -X POST https://xxxxxxxx.cn-hangzhou.fcapp.run/api/study-plan \
  -H "Content-Type: application/json" \
  -d '{"provider":"deepseek","courseName":"测试","messages":[{"role":"user","content":"你好"}],"lang":"zh"}'
```

Expected: 流式 SSE 响应，包含 AI 回复内容。

- [ ] **Step 8: 更新国内 OSS 中的 `config.js`**

```js
(function () {
  window.API_BASE = 'https://xxxxxxxx.cn-hangzhou.fcapp.run';
})();
```

上传到 OSS 并刷新 CDN 缓存：
```bash
ossutil cp config.js oss://exam-tracker-static/config.js
# 刷新 CDN 缓存
aliyun cdn RefreshObjectCaches --ObjectPath "https://exam.yourdomain.cn/config.js" --ObjectType File
```

- [ ] **Step 9: 更新国内前端默认 AI provider 为 DeepSeek**

由于 Gemini 国内不可用，国内版本应默认使用 DeepSeek。在国内的 `config.js` 中：

```js
(function () {
  window.API_BASE    = 'https://xxxxxxxx.cn-hangzhou.fcapp.run';
  window.DEFAULT_AI_PROVIDER = 'deepseek';
})();
```

然后在 `course.js` 中找到 AI provider 初始化处，添加对 `window.DEFAULT_AI_PROVIDER` 的读取（精确行号需 grep 确认）：

```bash
grep -n "provider\|gemini\|deepseek" course.js | grep -i "default\|initial\|='gemini'" | head -10
```

找到初始化行后，将硬编码的 `'gemini'` 改为：
```js
var provider = window.DEFAULT_AI_PROVIDER || 'gemini';
```

- [ ] **Step 10: 提交所有国内方案相关文件**

```bash
git add s.yaml server/index.js
git commit -m "feat: add Aliyun FC support for China deployment, DeepSeek as default provider"
```

---

## Task 6：文档更新与状态记录

- [ ] **Step 1: 更新 `STATUS.md` 环境变量表格**

在 `STATUS.md` 的环境变量表中添加：

```markdown
| `DEEPSEEK_API_KEY`   | Railway + 阿里云 FC                  | ✅ 已配置（Railway）/ ⬜ 待配置（FC）|
| `ANTHROPIC_API_KEY`  | Railway Dashboard                    | ⬜ 待配置 |
| `ALLOWED_ORIGINS`    | Railway + 阿里云 FC                  | ⬜ 待配置 |
```

- [ ] **Step 2: 在 `STATUS.md` 的 TASKS 表中添加本次任务**

```markdown
| P13 | Railway 后端迁移 + 国内访问方案 | ✅ 完成 | v=47 | Express 封装 + config.js + 阿里云 FC + DeepSeek |
```

- [ ] **Step 3: 在 `ROADMAP.md` 中添加里程碑**

在"已完成里程碑"末尾追加：

```markdown
### M8 — 部署架构升级 ✅
> 2026-05-22

- [x] 后端迁移至 Railway（Express.js 封装 Vercel Serverless Functions）
- [x] 前端通过 `config.js` 动态切换 API 基地址
- [x] 国内用户：阿里云 OSS + CDN + ICP 备案域名
- [x] 国内 AI：DeepSeek 作为 Gemini 替代（study-plan.js 已预置）
- [x] 国内后端：阿里云函数计算 FC（Node.js 18）
```

- [ ] **Step 4: 在 `SESSION_LOG.md` 追加记录**

```markdown
## 2026-05-22

- feat: Railway 后端迁移方案 — Express server + config.js API 基地址
- feat: 阿里云 FC + DeepSeek 国内部署方案
- docs: 迁移设计规格 & 执行计划
```

- [ ] **Step 5: 提交文档变更**

```bash
git add STATUS.md ROADMAP.md SESSION_LOG.md
git commit -m "docs: update STATUS/ROADMAP/SESSION_LOG for Railway migration and China access plan"
```

---

## 自检清单

### Spec 覆盖检查

| 需求 | 对应 Task |
|---|---|
| 后端迁移至 Railway | Task 1, 2, 3 |
| 前端保留 Vercel | Task 2（config.js 零侵入） |
| CORS 处理 | Task 1（server/index.js cors 配置） |
| 国内前端 CDN | Task 4 |
| 国内后端（FC） | Task 5 |
| AI 替代（DeepSeek） | Task 5 Step 7-9 |
| 文档更新 | Task 6 |

### 已知限制

1. **MinerU 国内可用性**：尚未验证 MinerU API 是否可从国内访问。若不可用，国内用户的 PDF 解析功能需要寻找替代服务（阿里云文档智能 IDP 是候选方案，需单独立项）。
2. **Gemini 国内完全封锁**：国内后端的 `GEMINI_API_KEY` 应留空或配置为空字符串，避免无效调用。
3. **ICP 备案**：国内域名必须完成 ICP 备案才能使用 CDN 加速，备案周期约 20 个工作日。
4. **Railway 免费层限制**：Railway Starter Plan 每月有 $5 用量上限，生产使用需升级至 Pro。
5. **`server/` 目录与 Vercel Serverless 共存**：`railway.json` 和 `server/` 的存在不影响 Vercel 的部署行为（Vercel 只使用 `api/` 目录），两者可以并存。

---

> 计划保存至 `docs/superpowers/plans/2026-05-22-railway-migration-china-access.md`
