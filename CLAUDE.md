# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目语言

与用户沟通使用**中文**。代码注释、变量命名使用英文。

## 项目概述

智能报销单生成系统。员工通过**飞书小程序**用自然语言或拍照票据发起报销，后端调用 OpenRouter 多模态 LLM 提取字段，对比公司报销规定后，调用飞书 Open API 发起已有审批流程。

完整设计文档：`docs/superpowers/specs/2026-06-30-smart-reimbursement-design.md`

## 仓库结构（规划中）

```
miniapp/          ← 飞书小程序（TTSS 原生框架）
  pages/
    index/        ← 首页入口（自然语言 vs OCR 选择）
    input/        ← 自然语言输入
    ocr/          ← 拍照/上传票据
    preview/      ← 预览确认（含软提示）
    success/      ← 提交成功
    settings/     ← OpenRouter API Key 设置

server/           ← Node.js + Express 后端
  src/
    routes/       ← extract / validate / submit / key
    services/
      llm.js      ← OpenRouter 调用（openai SDK，base_url 指向 OpenRouter）
      feishu.js   ← 飞书 OAuth2 + 审批 Open API
      crypto.js   ← AES-256-GCM 加解密用户 API Key
      rules.js    ← 报销规定比对逻辑
    prisma/
      schema.prisma
```

## 关键架构决策

**单一 `/api/extract` 接口处理两种输入：** 自然语言（文字）和 OCR（图片）均通过同一个接口，用请求体的 `content_type` 字段区分，LLM 返回统一的 JSON 结构：
```json
{ "date": "", "amount": 0, "type": "", "vendor": "", "reason": "" }
```

**用户 API Key 存储：** 前端提交后，后端立刻加密（AES-256-GCM，每用户独立随机 IV），存入 `users` 表，后续请求前端不携带 Key，由后端解密后直接调用 OpenRouter。前端永远不再接触原始 Key。

**身份验证：** 每个后端请求携带飞书 OAuth `code`，后端换取 `open_id` 后再处理业务，以 `open_id` 作为用户唯一标识。

**校验为软提示：** 报销规定校验只返回提示信息，不拦截提交。`/api/validate` 返回 `{ warnings: [], passed: true }` 结构。

## 环境变量（server/.env）

```
DATABASE_URL=          # 云数据库 PostgreSQL 连接串
FEISHU_APP_ID=         # 飞书自建应用 App ID
FEISHU_APP_SECRET=     # 飞书自建应用 App Secret
FEISHU_APPROVAL_CODE=  # 已有报销审批流程的 approval_code
ENCRYPT_SECRET=        # AES-256 加密主密钥（32字节，base64）
```

## 开发命令（代码初始化后更新）

```bash
# 后端
cd server
npm install
npx prisma migrate dev   # 数据库迁移
npm run dev              # 启动开发服务器

# 小程序
# 使用飞书开发者工具打开 miniapp/ 目录
```

## 实施前未确认事项

在开始实施前，以下信息需要从用户处获取：
1. 飞书审批流程的 `approval_code`（由飞书管理员提供）
2. 云数据库具体平台（阿里云 RDS / 腾讯云 / 其他）
3. 后端部署平台
4. 公司报销规定 PDF/Word 文件（用于初始化 `reimbursement_rules` 表）
