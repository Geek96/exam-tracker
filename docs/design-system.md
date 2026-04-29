# Design System — 复习追踪器

## 1. 色彩系统

所有颜色通过 CSS 自定义变量定义于 `styles.css` 的 `:root`。

### 全局变量

| 变量 | 值 | 用途 |
|---|---|---|
| `--bg` | `#0d0d1a` | 页面背景 |
| `--card` | `#13132a` | 卡片/面板背景 |
| `--card2` | `#1a1a35` | 次级卡片背景 |
| `--accent` | `#7c5cfc` | 主强调色（紫色） |
| `--accent2` | `#5b8def` | 副强调色（蓝色） |
| `--text` | `#e8e8f0` | 主文字 |
| `--muted` | `#6b6b8a` | 次要文字 |
| `--border` | `rgba(255,255,255,0.08)` | 边框 |
| `--urgent` | `#f97b6b` | 紧急/警告色 |
| `--soon` | `#f0b429` | 临近提醒色 |
| `--success` | `#59c185` | 成功色 |

### 课程卡片颜色选项

用户可选择的 8 种课程颜色标签：

| 颜色 | Hex |
|---|---|
| 蓝色（默认） | `#5B8DEF` |
| 珊瑚红 | `#F97B6B` |
| 绿色 | `#59C185` |
| 金黄 | `#F0B429` |
| 紫色 | `#A78BFA` |
| 天蓝 | `#38BDF8` |
| 玫瑰红 | `#FB7185` |
| 翠绿 | `#34D399` |

---

## 2. 排版

| 元素 | 字体大小 | 字重 |
|---|---|---|
| 页面标题 | `18px` | `600` |
| 卡片标题 | `15px` | `600` |
| 正文 | `14px` | `400` |
| 次要说明 | `12px` | `400` |
| 按钮文字 | `13px` | `500` |

**字体栈**: `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`

---

## 3. 组件规范

### 按钮类型

| 类名 | 用途 | 样式特征 |
|---|---|---|
| `.btn-submit` | 主操作（提交/确认） | 实心紫色背景 |
| `.btn-cancel` | 次要操作（取消） | 透明背景 + 边框 |
| `.btn-sm` | 小型操作按钮 | 圆角矩形，`padding: 4px 10px` |
| `.btn-sm.accent` | 带强调色的小按钮 | 主色背景 |

### 弹窗（Modal）

- 遮罩层：`.modal-overlay`，`background: rgba(0,0,0,0.6)`，`backdrop-filter: blur(4px)`
- 弹窗容器：`.modal`，`max-width: 480px`（宽弹窗 `.modal-wide` 为 `660px`）
- 标准结构：`.modal-header` → `.modal-body` → `.modal-footer`
- 关闭按钮：`.modal-close`，固定在右上角

### 卡片（Holo 风格）

课程卡片和章节导航卡使用 Holo 边框效果：
- 外层容器：`.holo-card-border`（渐变边框）
- 内层容器：`.holo-card-surface`（毛玻璃背景）

### Toast 提示

- 底部居中浮层，`z-index: 9999`
- 自动 2.5 秒消失
- 通过 `showToast(msg)` 调用

---

## 4. 布局规范

### 课程详情页（course.html）

采用两栏布局（`course-layout`）：
- **左栏**（38%）：章节目录 + 课程资料
- **右栏**（62%）：AI 学习助手（含历史侧边栏）

响应式断点：`768px` 以下切换为单栏。

### 课程列表页（index.html）

- 顶部固定 Header
- 卡片网格：`grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))`

---

## 5. 动效规范

- 卡片出现：`fadeInUp` 动画，间隔 `60ms`（`animation-delay: ${index * 60}ms`）
- 弹窗出现：`scaleIn` 动画，`0.2s ease`
- 按钮悬停：`transform: translateY(-1px)`，`0.15s`
- 不使用 `transition: all`，只对特定属性加过渡

---

## 6. 图标使用

项目使用 Unicode Emoji 作为图标，不依赖图标库：

| Emoji | 含义 |
|---|---|
| 📚 | 课程/章节目录 |
| 📋 | 复习计划 |
| 📖 | 总结/阅读 |
| ❓ | 测验 |
| 📎 | 附件/上传 |
| ✦ | AI 助手标志 |
| 🕐 | 历史记录 |
| 🤖 | MinerU AI 解析 |
