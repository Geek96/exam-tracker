# RAG 章节检索修复设计

**日期**: 2026-05-01  
**状态**: 待实现  
**目标文件**: `material-rag.js`

---

## 问题陈述

用户查询"3.4节第3题"时，RAG 返回第二章内容。根本原因有两处：

1. **chunk 元数据污染**：`sectionNo` 从 `标题路径 + 内容前500字` 联合提取，导致第二章 chunk 里的 `equation (3.4)` / `Figure 3.4` 被误识别为 Section 3.4，得分 100（章节精确匹配）反超真正的 3.4 节内容。

2. **查询侧误匹配**：`extractQueryHints` 对 `3.4` 没有上下文区分，"公式(3.4)" 和 "3.4节" 会提取出相同的 `sectionNo`，导致错误检索。

---

## 设计原则

> 任何形式的 `X.Y`，只有在明确的章节上下文下才被识别为章节号，否则一律忽略。

---

## 改动清单（全部在 `material-rag.js`）

### 改动 1：`chunkMarkdownMaterial` — sectionNo 只从标题路径提取

**位置**：`emit()` 函数内

```js
// 改前
const metadataText = currentPath.join(' ') + ' ' + part.slice(0, 500);
const sectionNo = detectSection(metadataText);

// 改后
const pathText = currentPath.join(' ');
const sectionNo = detectSection(pathText);
// pageNo 仍从内容提取（页码标记不会造成误匹配）
const pageNo = detectPage(part.slice(0, 500));
```

**效果**：第二章 chunk 内容里的 `equation (3.4)` 不再污染 `sectionNo`。

---

### 改动 2：`extractQueryHints` — 查询归一化

在提取 `sectionNo` 之前，分两步处理查询：

**步骤 A：剥离非章节的 X.Y 用法**

```js
const FORMULA_REF_RE = /(?:公式|equation|formula|fig(?:ure)?|图|表|table|eq)[.\s(（]*(\d+\.\d+)/gi;
q = q.replace(FORMULA_REF_RE, ' ');
```

**步骤 B：归一化多形式章节引用为 X.Y**

```js
// 中文：第三章第四节 / 第3章第4节
const ZH_CHAPTER_SECTION_RE = /第\s*([零一二三四五六七八九十百\d]+)\s*章\s*第\s*([零一二三四五六七八九十百\d]+)\s*节/i;
// 英文：chapter 3 section 4
const EN_CHAPTER_SECTION_RE = /chapter\s+(\d+)\s+section\s+(\d+)/i;
```

中文数字转换表：`{ 零:0, 一:1, 二:2, 三:3, 四:4, 五:5, 六:6, 七:7, 八:8, 九:9, 十:10 }`

归一化后再调用现有的 `detectSection(q)`。

---

### 改动 3：`buildTargetedExcerpt` — 全文搜索降权非标题行

搜索 `sectionNo`（如 `3.4`）时，对命中位置按行类型差异化评分：

```js
// 改前（所有命中统一评分）
addCandidate(pos, /^#{1,6}\s+/.test(line) ? 120 : 70, 'section');

// 改后（公式/图/表引用降到 0）
const isHeading = /^#{1,6}\s+/.test(line);
const isNonSectionRef = /(?:公式|equation|formula|fig(?:ure)?|图|表|table|eq)[\s(（]*/i.test(
  lineAround(source, Math.max(0, pos - 20))  // 看命中点前20字符的上下文
);
const score = isHeading ? 120 : isNonSectionRef ? 0 : 70;
addCandidate(pos, score, 'section');
```

**效果**：`buildTargetedExcerpt` 不再把 `equation (3.4)` 当作定位锚点。

---

### 改动 4：`INDEX_VERSION` 递增

```js
const INDEX_VERSION = 46;  // 从 45 → 46
```

强制用户浏览器重建索引，使新的 `sectionNo`（仅从标题路径提取）生效。

---

### 同步更新

- `course.html`：`material-rag.js?v=45` → `v=46`
- `STATUS.md`：版本号与近期变更更新

---

## 不在本次范围内

- Embedding 语义检索（后续可选增强）
- LLM 查询预处理
- TOC 预解析映射表（标题已含章节号，暂不需要）

---

## 验收标准

| 查询 | 期望 |
|---|---|
| `3.4节第3题` | 返回 Section 3.4 内容 |
| `第三章第四节第3题` | 返回 Section 3.4 内容 |
| `chapter 3 section 4 problem 3` | 返回 Section 3.4 内容 |
| `公式(3.4)是什么意思` | 不定位到 Section 3.4，按关键词检索 |
| `图3.4说明了什么` | 不定位到 Section 3.4，按关键词检索 |
