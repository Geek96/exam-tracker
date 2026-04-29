# ADR-003: 使用 litterbox.catbox.moe 作为临时文件中转服务

**日期**: 2026-04-29  
**状态**: 已接受（替代 tmpfiles.org）

## 背景

MinerU API 要求提供公网可访问的文件 URL。需要在浏览器端将 PDF 上传到一个公网可访问的临时服务。

## 变更历史

1. **初版**：将 PDF base64 编码后通过 Vercel Function 代理传给 MinerU  
   → 失败原因：Vercel Function 请求体限制 4.5MB，base64 编码增加 33% 体积

2. **v2**：浏览器直传 `tmpfiles.org`  
   → 失败原因：`ERR_CERT_COMMON_NAME_INVALID`（tmpfiles.org CDN 的 SSL 证书与域名不匹配）

3. **v3（当前）**：浏览器直传 `litterbox.catbox.moe`

## 决策

使用 `litterbox.catbox.moe` 提供 72 小时临时文件托管。

## 理由

- SSL 证书完全有效，无浏览器安全错误
- API 极简：POST multipart → 返回纯文本直链 `https://litter.catbox.moe/xxx.pdf`
- 支持大文件（单文件最大 1GB，足够分片后的 PDF）
- 无需注册或 API Key
- 72 小时有效期对 MinerU 处理任务完全够用

## 风险与监控

- **服务可用性**：catbox.moe 是个人运营的免费服务，存在间歇性故障风险
- **访问限制**：不确定国内 MinerU 服务器是否能访问该域名

**建议**：如果上传失败率上升，考虑添加备用服务（如 `0x0.st`）作为 fallback。
