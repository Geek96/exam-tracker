# EXA-10 Technical Report: Material Import Prompts

## Scope

Adjusted the course materials import controls and MinerU conversion task feedback without changing upload, conversion, storage, or resume behavior.

## Implementation

- `strings.js` keeps the existing `pdfConvert` and `htmlConvert` keys, but changes visible copy to import wording across zh/en/es.
- `course.html` updates the static fallback labels and bumps `course.js` cache busting from `v=48` to `v=49`.
- `course.css` moves `#mineruFloat` default anchoring from top-right to bottom-left.
- `course.js` adds `materialConvertStatus()` and `materialConvertStatusFromMineruMsg()` so material conversion jobs show stable user-facing phases:
  - upload: `正在上传pdf/html。转换时间可能较长,请耐心等待`
  - convert: `正在转换为md文档。转换时间可能较长,请耐心等待`
  - done: `转换完成!`

## Verification Coverage

- Static regression test added in `tests/p6-p8-regression.test.js`.
- The test checks the new import labels, `v=49` cache version, bottom-left float CSS, and required phase prompt strings.
