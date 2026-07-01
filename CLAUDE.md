# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目语言

与用户沟通使用**中文**。代码注释、变量命名使用英文。

## 项目概述

智能报销单生成系统。员工通过**飞书小程序**用自然语言或拍照票据发起报销，后端调用 OpenRouter 多模态 LLM 提取字段，对比公司报销规定后，调用飞书 Open API 发起已有审批流程。

完整设计文档：`docs/superpowers/specs/2026-06-30-smart-reimbursement-design.md`

## 开发命令

```bash
# 后端
cd server
npm install
npx prisma migrate dev       # 开发环境数据库迁移
npx prisma migrate deploy    # 生产环境数据库迁移
node scripts/seed-rules.js   # 录入报销规定种子数据
npm run dev                  # 启动开发服务器（nodemon）
npm start                    # 启动生产服务器

# 测试
cd server
npm test                     # 运行所有测试（25 个）
npx jest tests/routes/auth.test.js -v   # 运行单个测试文件
npx jest -t "POST /api/extract"         # 按名称匹配测试

# 小程序
# 使用飞书开发者工具打开 miniapp/ 目录
```

## 架构

### 后端（Node.js 20 + Express v5 + Prisma v6 + PostgreSQL）

`server/src/app.js` 注册所有路由，`server/index.js` 启动服务。CommonJS（`"type": "commonjs"`）。

**路由层** (`src/routes/`)：每个文件对应一个路由，均通过 `router.use(auth)` 统一保护（`/api/auth` 除外）。Express v5 async handler 错误自动传播，无需手动 try-catch。

**服务层** (`src/services/`)：
- `prisma.js` — 全局单例 `PrismaClient`，所有路由从此引用
- `crypto.js` — AES-256-GCM 加解密，每次加密生成独立随机 12 字节 IV，密文以 JSON 字符串存储
- `feishu.js` — 飞书 OAuth2（code → app_access_token → open_id）+ 审批提交
- `llm.js` — OpenRouter 调用，`baseURL` 指向 `https://openrouter.ai/api/v1`，模型 `google/gemini-2.0-flash-001`
- `rules.js` — 从 `reimbursement_rules` 表读取规定，校验金额上限，符合规定返回空 `warnings[]`

**中间件** (`src/middleware/auth.js`)：验证 `Authorization: Bearer <JWT>`，注入 `req.openId`。

### 关键架构决策

**单一 `/api/extract` 接口：** 文字和图片均通过同一接口，用 `content_type: "text"|"image"` 区分。图片 content 为 base64 data URL（`data:image/jpeg;base64,...`）。LLM 统一返回：
```json
{ "date": "YYYY-MM-DD", "amount": 0, "type": "", "vendor": "", "reason": "" }
```

**用户 API Key 存储：** 前端提交后后端加密存入 `users` 表，后续请求前端不携带 Key，由后端解密直接调用 OpenRouter。

**身份验证流程：** 飞书小程序 `tt.login()` → code → `POST /api/auth` → JWT（7 天有效）→ Bearer token 自动附加到所有后续请求。

**校验为软提示：** `/api/validate` 始终返回 `{ warnings: [], passed: true }`，不拦截提交。

### 飞书小程序（TTSS 原生框架，ES module）

`miniapp/config.js` 中配置 `BASE_URL`（部署后替换为实际后端地址）。

**工具层** (`utils/`)：
- `auth.js` — `getToken()` 读缓存或调 `tt.login()` 重新登录，token 存入 `tt.setStorageSync`
- `request.js` — 封装 `tt.request()`，自动附加 Bearer header，HTTP ≥ 400 抛出 Error

**页面数据流：** `input` / `ocr` 页提取完成后，将 `{ date, amount, type, vendor, reason, warnings }` 写入 `getApp().globalData.extractedData`；`preview` 页读取展示并提交；成功后 `instance_code` 存入 `globalData.instanceCode`，跳转 `success` 页。

### 数据库 Schema

```prisma
model User {
  open_id           String   @id
  encrypted_api_key String?
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt
}

model ReimbursementRule {
  id          Int      @id @default(autoincrement())
  category    String   @unique
  max_amount  Decimal  @db.Decimal(10, 2)
  description String
  updated_at  DateTime @updatedAt
}
```

## 环境变量（`server/.env`）

```
DATABASE_URL=          # 云数据库 PostgreSQL 连接串
FEISHU_APP_ID=         # 飞书自建应用 App ID
FEISHU_APP_SECRET=     # 飞书自建应用 App Secret
FEISHU_APPROVAL_CODE=  # 已有报销审批流程的 approval_code
ENCRYPT_SECRET=        # AES-256 加密主密钥（32字节 base64，生成：openssl rand -base64 32）
JWT_SECRET=            # JWT 签名密钥
```

## 上线前待办

1. **飞书审批 widget ID**：`server/src/services/feishu.js` `submitApproval` 函数中 form 数组的 `id` 字段为占位符，需从飞书审批管理后台获取真实表单控件 ID
2. **`miniapp/config.js`**：将 `BASE_URL` 替换为实际后端地址
3. **种子数据**：运行 `node scripts/seed-rules.js` 录入公司报销规定
