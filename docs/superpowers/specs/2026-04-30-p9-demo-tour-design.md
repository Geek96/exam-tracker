# p9 Demo 引导流程 — 设计文档

**日期**: 2026-04-30  
**状态**: 已批准  
**目标版本**: v=37

---

## 目标

为方便普通用户快速理解应用功能，提供一个名为"线性代数 Demo"的预置课程。用户进入该课程后，自动启动侧边引导面板，一步步体验核心功能，可随时跳过或重置。

---

## 架构

### Demo 课程预置

- 固定 `courseId`：`"__demo__"`
- 课程名：线性代数 Demo
- 预置颜色：`#A78BFA`（紫色）
- 预置科目：数学
- 预置 6 个章节：
  - Chapter 1: Vector Spaces
  - Chapter 2: Linear Transformations
  - Chapter 3: Elementary Matrix Operations
  - Chapter 4: Determinants
  - Chapter 5: Diagonalization
  - Chapter 6: Inner Product Spaces
- 预置一份 Markdown 资料（线代前几页内容，硬编码于 `demo-tour.js`）
- 预置一场考试（期末考，已预填，供重置后恢复）

`app.js` 在初始化课程列表时检测 `__demo__` 是否存在，不存在则自动创建并注入预置数据。

### 文件结构

```
demo-tour.js          # 新增：引导模块，独立于 course.js
course.js             # 小改：检测 courseId === '__demo__' 时加载 demo-tour.js
course.html           # 小改：引入 demo-tour.js；新增面板 DOM 骨架
app.js                # 小改：初始化时预置 demo 课程
demo/                 # 已有：存放线代 PDF（不直接使用，仅作参考）
```

### 模块职责

**`demo-tour.js`**：
- 定义 10 步引导配置数组（每步含：目标选择器、面板标题、说明文案、推进触发方式）
- 维护 `stepIndex` 状态
- 渲染侧边面板，监听用户操作自动推进
- 暴露 `resetDemo()` 函数：清空 `__demo__` 课程下的考试/章节完成状态/聊天记录/资料索引，重新注入预置数据，从步骤 1 重启

---

## 引导步骤详细定义

| # | 步骤名 | 目标元素选择器 | 推进方式 | 面板文案 |
|---|---|---|---|---|
| 1 | 欢迎 | `.course-header`（课程标题区） | 点击"下一步" | "欢迎来到线性代数 Demo！我们会一步步带你体验所有功能。" |
| 2 | 添加考试 | `#btnAddExam` | 用户点击该按钮后 Modal 打开 → 自动推进 | "点击这里添加一场考试" |
| 3 | 确认考试 | 考试 Modal 表单 | 表单已预填，用户点击"确认"后推进 | "表单已预填好了，直接点击确认即可" |
| 4 | 章节目录 | `.chapter-list` | 点击"下一步" | "这是自动提取的 6 个章节，你可以追踪每章的完成进度" |
| 5 | 勾选章节 | 第一个章节行 | 用户点击勾选后推进 | "点击任意章节，标记为已完成" |
| 6 | 资料区 | `.materials-section` | 点击"下一步" | "这里有一份预先准备好的线性代数资料，已转换为 AI 可读格式" |
| 7 | 打开 AI 助手 | AI 助手面板区域 | 点击"下一步" | "AI 学习助手可以阅读你的教材，回答各种学习问题" |
| 8 | 选择资料文件 | 文件下拉选择器 | 用户选择文件后推进 | "在下拉菜单中选择资料文件，AI 将基于它来回答问题" |
| 9 | 预制问题 | AI 输入框 | 至少发送一个问题后，面板出现"下一步"按钮 | 面板展示三个可点击按钮，点击后自动填入输入框并发送 |
| 10 | 保存 & 预览 | 保存按钮 | 用户点击保存 → 再点预览 → 引导结束 | "AI 的回复可以保存为资料，点击保存，再点预览查看渲染效果" |

**结束页**：面板显示"🎉 Demo 完成！现在可以创建你自己的课程了"，提供"关闭引导"按钮。

### 步骤 9 预制问题

三个按钮按顺序显示，点击后自动填入 AI 输入框并触发发送：

1. 📖 总结第一章
2. ✏️ 解决 3.4 节课后习题的第三题
3. ∑ 总结 1-6 章中的所有重要公式

---

## 侧边面板 UI 规格

- **宽度**：200px，固定在课程页右侧（`position: fixed; right: 0`）
- **高度**：全屏高度，z-index 高于主内容
- **背景**：`#13132a`，左边框 `1px solid rgba(91,141,239,0.4)`
- **目标元素高亮**：`box-shadow: 0 0 0 3px rgba(91,141,239,0.5), 0 0 16px rgba(91,141,239,0.4)`，脉冲动画
- **面板内容**（从上到下）：
  - 步骤序号圆圈 + "步骤 N / 10"
  - 进度条（线性渐变蓝→紫）
  - 步骤标题（bold）
  - 说明文案
  - 弹性空白
  - "跳过此步"按钮（灰色边框）
  - 分隔线
  - "↺ 重置 Demo"按钮（红色边框，点击弹确认对话框）

---

## 重置逻辑

点击"重置 Demo"→ 确认弹窗 → 执行：

1. 删除 `__demo__` 课程下所有考试记录（IndexedDB）
2. 清空所有章节 `completed` 状态（重置为 6 个预置章节）
3. 清空 `examTrackerChatSessions` 中属于 `__demo__` 的会话
4. 清空 `examTrackerMaterialChunks` 中属于 `__demo__` 的索引
5. 删除 `__demo__` 课程下所有用户上传资料（保留预置 Markdown 资料）
6. 重置 `stepIndex = 0`，面板回到步骤 1

---

## 跳过行为

- 每步显示"跳过此步"按钮，点击直接推进到下一步（不执行该步的操作）
- 面板右上角提供"✕ 退出引导"，彻底关闭面板（`localStorage` 记录 `demoTourDismissed = true`）
- 再次进入 Demo 课程时：若 `demoTourDismissed` 为 true，面板不自动弹出，但页面顶部显示"重新开始引导"按钮

---

## 国际化

所有三种语言（zh / en / es）都有完整的 demo 体验，语言跟随 `app_lang` 设置，切换后 demo 内容同步更新。

**步骤文案**：新增约 30 个 i18n key，覆盖中/英/西班牙语，遵循现有 `strings.js` 格式。

**预置章节名**（随语言切换）：

| zh | en | es |
|---|---|---|
| 第一章：向量空间 | Chapter 1: Vector Spaces | Capítulo 1: Espacios vectoriales |
| 第二章：线性变换 | Chapter 2: Linear Transformations | Capítulo 2: Transformaciones lineales |
| 第三章：初等矩阵运算 | Chapter 3: Elementary Matrix Operations | Capítulo 3: Operaciones matriciales elementales |
| 第四章：行列式 | Chapter 4: Determinants | Capítulo 4: Determinantes |
| 第五章：对角化 | Chapter 5: Diagonalization | Capítulo 5: Diagonalización |
| 第六章：内积空间 | Chapter 6: Inner Product Spaces | Capítulo 6: Espacios con producto interno |

**预制考试名**（随语言切换）：

| zh | en | es |
|---|---|---|
| 期末考试 | Final Exam | Examen Final |

**步骤 9 预制问题**（随语言切换）：

| zh | en | es |
|---|---|---|
| 📖 总结第一章 | 📖 Summarize Chapter 1 | 📖 Resume el Capítulo 1 |
| ✏️ 解决 3.4 节课后习题的第三题 | ✏️ Solve exercise 3 from section 3.4 | ✏️ Resuelve el ejercicio 3 de la sección 3.4 |
| ∑ 总结 1-6 章中的所有重要公式 | ∑ Summarize all key formulas from chapters 1-6 | ∑ Resume todas las fórmulas clave de los capítulos 1-6 |

**预置 Markdown 资料**：内容本身为英文原著（线性代数教材），三种语言下共享同一份资料，无需翻译。

---

## 不在范围内

- MinerU PDF 转换步骤（耗时过长，demo 使用预置 Markdown）
- 移动端响应式（p3 单独处理）
- 用户账号系统
