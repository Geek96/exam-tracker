# 复习追踪器 / Study Tracker

> 帮助学生管理课程章节进度、导入教材、并通过 AI 助手制定复习计划。

**在线访问**: [Vercel 部署链接]  
**技术栈**: HTML · CSS · Vanilla JS · Vercel Serverless Functions  
**AI 引擎**: Google Gemini（对话 + 目录生成）· MinerU（PDF 解析）

---

## 功能概览

| 功能 | 状态 |
|---|---|
| 课程管理（增删改，颜色标签，考试日期倒计时） | ✅ |
| PDF 书签自动提取章节目录 | ✅ |
| MinerU AI 智能提取目录（无书签 PDF）| ✅ |
| 手动添加/编辑章节 | ✅ |
| 章节完成度追踪 | ✅ |
| 课程资料管理（PDF/Markdown/HTML 上传）| ✅ |
| PDF → Markdown 转换（MinerU）| ✅ |
| AI 学习助手（Gemini 流式对话）| ✅ |
| 多会话对话历史 | ✅ |
| 三语支持（中/英/西）| ✅ |
| 欢迎页语言选择 | ✅ |
| LaTeX 数学公式渲染（KaTeX）| ✅ |

---

## 本地开发

本项目**无构建步骤**，直接用浏览器打开 HTML 文件即可预览静态部分。

如需测试 API 功能，需安装 Vercel CLI 并配置环境变量：

```bash
npm i -g vercel
vercel env pull .env.local   # 从 Vercel Dashboard 拉取环境变量
vercel dev                    # 启动本地开发服务（含 Serverless Functions）
```

### 必须的环境变量

| 变量 | 获取方式 |
|---|---|
| `GEMINI_API_KEY` | [Google AI Studio](https://aistudio.google.com) |
| `MINERU_API_KEY` | [MinerU 官网](https://mineru.net) 注册后获取 |

---

## 项目结构

```
exam-tracker/
├── .agents/          # AI Agent 行为准则 & 开发日志
├── .github/          # CI/CD (Vercel 自动部署)
├── api/              # Vercel Serverless Functions
│   ├── study-plan.js
│   ├── generate-toc.js
│   ├── mineru-submit.js
│   └── mineru-result.js
├── docs/             # 架构文档 & 设计规范
│   ├── adr/          # 架构决策记录
│   ├── design-system.md
│   └── sitemap.md
├── public/           # 静态资源（图片、字体）
├── src/              # 预留源码目录（当前项目为平铺结构）
├── app.js            # 课程列表页逻辑
├── course.js         # 课程详情页逻辑
├── strings.js        # i18n 字符串 & t()/tf() 函数
├── index.html        # 课程列表页
├── course.html       # 课程详情页
├── welcome.html      # 欢迎/语言选择页
├── styles.css        # 全局样式
├── course.css        # 课程详情页专属样式
├── welcome.css       # 欢迎页样式
├── STATUS.md         # 实时项目状态
└── ROADMAP.md        # 开发路线图
```

---

## 贡献 / AI 辅助开发

在使用 AI Agent 修改本项目前，请先阅读 [`.agents/AGENT_GUIDELINES.md`](.agents/AGENT_GUIDELINES.md)。
