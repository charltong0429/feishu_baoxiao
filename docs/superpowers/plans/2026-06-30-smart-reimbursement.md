# 智能报销单生成系统 · 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建飞书小程序 + Node.js 后端，让员工通过自然语言或 OCR 票据识别在飞书中一键发起报销审批流程。

**Architecture:** 前后端分离。飞书小程序（TTSS 原生）调用 Express REST API；后端通过飞书 OAuth 换取 `open_id` 并签发 JWT，用 AES-256-GCM 加密存储每位员工的 OpenRouter API Key，调用 OpenRouter 多模态 LLM 从文字或图片中提取结构化字段，最终通过飞书审批 Open API 发起审批实例。

**Tech Stack:** Node.js 20 · Express 4 · Prisma 5 · PostgreSQL（云数据库）· Jest + Supertest · openai SDK（指向 OpenRouter）· 飞书小程序 TTSS 原生框架

## Global Constraints

- Node.js 最低版本：20 LTS
- 所有 `/api/*` 路由（`/api/auth` 除外）必须通过 `Authorization: Bearer <jwt>` 验证
- 用户 OpenRouter API Key 只在后端加密存储，前端禁止接触原始 Key
- OCR 图片仅在内存处理，禁止写入磁盘
- 报销规定校验仅做软提示（`passed` 永远为 `true`），不拦截提交
- `FEISHU_APPROVAL_CODE`、`FEISHU_APP_ID`、`FEISHU_APP_SECRET` 须在实施前从管理员处获取
- 飞书审批表单的真实 widget ID 须从飞书管理后台获取，替换 Task 8 中的占位符
- 首版不包含：多笔明细拆分、历史记录、管理员后台、报销统计看板

---

## File Map

### 后端（server/）

| 文件 | 职责 |
|------|------|
| `server/index.js` | Express listen 入口 |
| `server/src/app.js` | Express 配置（不含 listen，便于测试） |
| `server/src/services/crypto.js` | AES-256-GCM 加解密 |
| `server/src/services/feishu.js` | 飞书 App Access Token + `getOpenId` + `submitApproval` |
| `server/src/services/llm.js` | OpenRouter 调用封装（文字 + 图片） |
| `server/src/services/rules.js` | 从 DB 加载规则 + 软提示校验 |
| `server/src/middleware/auth.js` | JWT 验证，注入 `req.openId` |
| `server/src/routes/auth.js` | `POST /api/auth` |
| `server/src/routes/key.js` | `GET/POST /api/key` |
| `server/src/routes/extract.js` | `POST /api/extract` |
| `server/src/routes/validate.js` | `POST /api/validate` |
| `server/src/routes/submit.js` | `POST /api/submit` |
| `server/prisma/schema.prisma` | DB 模型 |
| `server/scripts/seed-rules.js` | 初始化报销规定数据 |
| `server/tests/services/crypto.test.js` | |
| `server/tests/services/rules.test.js` | |
| `server/tests/routes/auth.test.js` | |
| `server/tests/routes/key.test.js` | |
| `server/tests/routes/extract.test.js` | |
| `server/tests/routes/validate.test.js` | |
| `server/tests/routes/submit.test.js` | |

### 小程序（miniapp/）

| 文件 | 职责 |
|------|------|
| `miniapp/config.js` | 后端 `BASE_URL` 配置 |
| `miniapp/utils/request.js` | 封装 `tt.request` 为 Promise，自动附加 Authorization header |
| `miniapp/utils/auth.js` | `tt.login()` + session token 存取 |
| `miniapp/pages/index/` | 首页入口（选择自然语言 or OCR） |
| `miniapp/pages/settings/` | API Key 设置页 |
| `miniapp/pages/input/` | 自然语言输入页 |
| `miniapp/pages/ocr/` | 拍照/上传票据页 |
| `miniapp/pages/preview/` | 预览确认页（含软提示） |
| `miniapp/pages/success/` | 提交成功页 |

---

## Task 1: 后端项目初始化

**Files:**
- Create: `server/package.json`
- Create: `server/.env.example`
- Create: `server/index.js`
- Create: `server/src/app.js`
- Create: `server/src/routes/auth.js`（占位）
- Create: `server/src/routes/key.js`（占位）
- Create: `server/src/routes/extract.js`（占位）
- Create: `server/src/routes/validate.js`（占位）
- Create: `server/src/routes/submit.js`（占位）

**Interfaces:**
- Produces: `src/app.js` exports `app`（Express instance）

- [ ] **Step 1: 创建目录结构**

```bash
mkdir -p server/src/services server/src/middleware server/src/routes \
         server/tests/services server/tests/routes server/scripts
cd server
npm init -y
```

- [ ] **Step 2: 安装依赖**

```bash
cd server
npm install express dotenv @prisma/client openai jsonwebtoken
npm install --save-dev jest supertest prisma nodemon
```

- [ ] **Step 3: 配置 package.json scripts**

将 `server/package.json` 的 `scripts` 和 `jest` 字段替换为：

```json
{
  "scripts": {
    "dev": "nodemon index.js",
    "start": "node index.js",
    "test": "jest --runInBand",
    "test:watch": "jest --watch --runInBand"
  },
  "jest": {
    "testEnvironment": "node"
  }
}
```

- [ ] **Step 4: 写占位路由文件**

对以下每个文件写相同内容（后续 Task 会替换）：

`server/src/routes/auth.js`、`key.js`、`extract.js`、`validate.js`、`submit.js`：

```javascript
const router = require('express').Router();
router.all('/', (req, res) => res.json({ ok: true }));
module.exports = router;
```

- [ ] **Step 5: 写 src/app.js**

```javascript
require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json({ limit: '20mb' }));

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/key',      require('./routes/key'));
app.use('/api/extract',  require('./routes/extract'));
app.use('/api/validate', require('./routes/validate'));
app.use('/api/submit',   require('./routes/submit'));

app.get('/health', (req, res) => res.json({ ok: true }));

module.exports = app;
```

- [ ] **Step 6: 写 index.js**

```javascript
const app = require('./src/app');
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

- [ ] **Step 7: 写 .env.example**

```
DATABASE_URL=postgresql://user:password@host:5432/reimbursement
FEISHU_APP_ID=cli_xxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FEISHU_APPROVAL_CODE=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ENCRYPT_SECRET=base64_encoded_32_bytes_random_key_here
JWT_SECRET=your_jwt_secret_here
PORT=3000
```

- [ ] **Step 8: 创建 .env 并验证服务器启动**

```bash
cd server && cp .env.example .env
node index.js
```

预期输出：`Server running on port 3000`

- [ ] **Step 9: 验证 health endpoint**

```bash
curl http://localhost:3000/health
```

预期：`{"ok":true}`

- [ ] **Step 10: Commit**

```bash
git add server/
git commit -m "feat: initialize backend project scaffold"
```

---

## Task 2: Prisma Schema 与数据库迁移

**Files:**
- Create: `server/prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma Client with models `User`、`ReimbursementRule`

- [ ] **Step 1: 初始化 Prisma**

```bash
cd server && npx prisma init --datasource-provider postgresql
```

- [ ] **Step 2: 写 prisma/schema.prisma**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  open_id           String   @id
  encrypted_api_key String?
  created_at        DateTime @default(now())
  updated_at        DateTime @updatedAt

  @@map("users")
}

model ReimbursementRule {
  id          Int      @id @default(autoincrement())
  category    String
  max_amount  Decimal  @db.Decimal(10, 2)
  description String
  updated_at  DateTime @updatedAt

  @@map("reimbursement_rules")
}
```

- [ ] **Step 3: 在 .env 填入真实云数据库 DATABASE_URL**

```
DATABASE_URL=postgresql://user:password@your-cloud-db-host:5432/reimbursement
```

- [ ] **Step 4: 运行迁移**

```bash
cd server && npx prisma migrate dev --name init
```

预期输出：`✔ Generated Prisma Client`

- [ ] **Step 5: 验证数据库连接**

```bash
npx prisma studio
```

打开 `http://localhost:5555`，确认能看到 `User` 和 `ReimbursementRule` 两张空表。

- [ ] **Step 6: Commit**

```bash
git add server/prisma/ server/.env.example
git commit -m "feat: add prisma schema with User and ReimbursementRule models"
```

---

## Task 3: AES-256-GCM 加解密服务

**Files:**
- Create: `server/src/services/crypto.js`
- Create: `server/tests/services/crypto.test.js`

**Interfaces:**
- Produces:
  - `encrypt(plaintext: string): string` → JSON 字符串 `{"encrypted":"...","iv":"...","authTag":"..."}` （所有字段 base64）
  - `decrypt(cipherJson: string): string` → 原始明文

- [ ] **Step 1: 写失败测试**

`server/tests/services/crypto.test.js`:

```javascript
process.env.ENCRYPT_SECRET = Buffer.from('a'.repeat(32)).toString('base64');

const { encrypt, decrypt } = require('../../src/services/crypto');

test('encrypt then decrypt returns original plaintext', () => {
  const original = 'sk-or-v1-test-key-12345';
  const cipherJson = encrypt(original);
  const parsed = JSON.parse(cipherJson);
  expect(parsed).toHaveProperty('encrypted');
  expect(parsed).toHaveProperty('iv');
  expect(parsed).toHaveProperty('authTag');
  expect(decrypt(cipherJson)).toBe(original);
});

test('two encryptions of same plaintext produce different ciphertexts', () => {
  const original = 'sk-or-v1-same-key';
  expect(encrypt(original)).not.toBe(encrypt(original));
});

test('tampered ciphertext throws on decrypt', () => {
  const parsed = JSON.parse(encrypt('secret'));
  parsed.encrypted = Buffer.from('tampered').toString('base64');
  expect(() => decrypt(JSON.stringify(parsed))).toThrow();
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
cd server && npx jest tests/services/crypto.test.js -v
```

预期：FAIL — `Cannot find module '../../src/services/crypto'`

- [ ] **Step 3: 实现 crypto.js**

`server/src/services/crypto.js`:

```javascript
const crypto = require('crypto');
const ALGORITHM = 'aes-256-gcm';

function getKey() {
  return Buffer.from(process.env.ENCRYPT_SECRET, 'base64');
}

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return JSON.stringify({
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64')
  });
}

function decrypt(cipherJson) {
  const { encrypted, iv, authTag } = JSON.parse(cipherJson);
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final()
  ]).toString('utf8');
}

module.exports = { encrypt, decrypt };
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx jest tests/services/crypto.test.js -v
```

预期：3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/services/crypto.js server/tests/services/crypto.test.js
git commit -m "feat: add AES-256-GCM crypto service"
```

---

## Task 4: 飞书 Auth 服务 + JWT 中间件 + `/api/auth` 路由

**Files:**
- Create: `server/src/services/feishu.js`（仅 `getOpenId`）
- Create: `server/src/middleware/auth.js`
- Modify: `server/src/routes/auth.js`
- Create: `server/tests/routes/auth.test.js`

**Interfaces:**
- Consumes: `FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`JWT_SECRET` from env
- Produces:
  - `feishu.getOpenId(code: string): Promise<string>` → 飞书 `open_id`
  - `auth` middleware: 设置 `req.openId: string`，无效 token 返回 401
  - `POST /api/auth` body: `{ code: string }` → `{ token: string }`（JWT，7天有效期）

- [ ] **Step 1: 写失败测试**

`server/tests/routes/auth.test.js`:

```javascript
jest.mock('../../src/services/feishu', () => ({ getOpenId: jest.fn() }));

const feishu = require('../../src/services/feishu');
const request = require('supertest');
const app = require('../../src/app');

beforeEach(() => {
  process.env.JWT_SECRET = 'test-secret';
  feishu.getOpenId.mockReset();
});

test('POST /api/auth returns token on valid code', async () => {
  feishu.getOpenId.mockResolvedValue('ou_test123');
  const res = await request(app).post('/api/auth').send({ code: 'valid-code' });
  expect(res.status).toBe(200);
  expect(typeof res.body.token).toBe('string');
});

test('POST /api/auth returns 400 if code missing', async () => {
  const res = await request(app).post('/api/auth').send({});
  expect(res.status).toBe(400);
});

test('POST /api/auth returns 401 if feishu rejects code', async () => {
  feishu.getOpenId.mockRejectedValue(new Error('invalid code'));
  const res = await request(app).post('/api/auth').send({ code: 'bad-code' });
  expect(res.status).toBe(401);
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx jest tests/routes/auth.test.js -v
```

预期：FAIL

- [ ] **Step 3: 实现 feishu.js（getOpenId）**

`server/src/services/feishu.js`:

```javascript
const https = require('https');

function post(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const { hostname, pathname } = new URL(url);
    const req = https.request(
      { hostname, path: pathname, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers } },
      (res) => { let raw = ''; res.on('data', c => raw += c); res.on('end', () => resolve(JSON.parse(raw))); }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function getAppAccessToken() {
  const res = await post(
    'https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal',
    { app_id: process.env.FEISHU_APP_ID, app_secret: process.env.FEISHU_APP_SECRET }
  );
  if (!res.app_access_token) throw new Error('Failed to get app access token');
  return res.app_access_token;
}

async function getOpenId(code) {
  const token = await getAppAccessToken();
  const res = await post(
    'https://open.feishu.cn/open-apis/mina/v2/tokenLoginValidate',
    { code },
    { Authorization: `Bearer ${token}` }
  );
  if (res.code !== 0 || !res.data?.open_id) throw new Error(`Feishu auth failed: ${res.msg}`);
  return res.data.open_id;
}

module.exports = { getOpenId };
```

- [ ] **Step 4: 实现 auth middleware**

`server/src/middleware/auth.js`:

```javascript
const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    req.openId = payload.open_id;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = auth;
```

- [ ] **Step 5: 实现 /api/auth 路由**

`server/src/routes/auth.js`:

```javascript
const router = require('express').Router();
const jwt = require('jsonwebtoken');
const feishu = require('../services/feishu');

router.post('/', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'code required' });
  try {
    const open_id = await feishu.getOpenId(code);
    const token = jwt.sign({ open_id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch {
    res.status(401).json({ error: 'Authentication failed' });
  }
});

module.exports = router;
```

- [ ] **Step 6: 运行测试确认通过**

```bash
npx jest tests/routes/auth.test.js -v
```

预期：3 tests PASS

- [ ] **Step 7: Commit**

```bash
git add server/src/services/feishu.js server/src/middleware/auth.js server/src/routes/auth.js server/tests/routes/auth.test.js
git commit -m "feat: add feishu auth service, JWT middleware, and /api/auth route"
```

---

## Task 5: API Key 存储路由 `/api/key`

**Files:**
- Modify: `server/src/routes/key.js`
- Create: `server/tests/routes/key.test.js`

**Interfaces:**
- Consumes: `encrypt(string): string`（from crypto.js），`auth` middleware，Prisma `User`
- Produces:
  - `GET /api/key`（auth 必须）→ `{ configured: boolean }`
  - `POST /api/key`（auth 必须）body: `{ api_key: string }` → `{ ok: true }`

- [ ] **Step 1: 写失败测试**

`server/tests/routes/key.test.js`:

```javascript
jest.mock('@prisma/client', () => {
  const mockPrisma = { user: { findUnique: jest.fn(), upsert: jest.fn() } };
  return { PrismaClient: jest.fn(() => mockPrisma) };
});

process.env.ENCRYPT_SECRET = Buffer.from('a'.repeat(32)).toString('base64');
process.env.JWT_SECRET = 'test-secret';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../../src/app');
const token = jwt.sign({ open_id: 'ou_test' }, 'test-secret');

beforeEach(() => { prisma.user.findUnique.mockReset(); prisma.user.upsert.mockReset(); });

test('GET /api/key returns configured:false when no key stored', async () => {
  prisma.user.findUnique.mockResolvedValue(null);
  const res = await request(app).get('/api/key').set('Authorization', `Bearer ${token}`);
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ configured: false });
});

test('GET /api/key returns configured:true when key exists', async () => {
  prisma.user.findUnique.mockResolvedValue({ encrypted_api_key: 'something' });
  const res = await request(app).get('/api/key').set('Authorization', `Bearer ${token}`);
  expect(res.body).toEqual({ configured: true });
});

test('POST /api/key saves encrypted key', async () => {
  prisma.user.upsert.mockResolvedValue({});
  const res = await request(app)
    .post('/api/key').set('Authorization', `Bearer ${token}`).send({ api_key: 'sk-or-v1-test-key' });
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ ok: true });
  expect(prisma.user.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { open_id: 'ou_test' } }));
});

test('GET /api/key returns 401 without token', async () => {
  const res = await request(app).get('/api/key');
  expect(res.status).toBe(401);
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx jest tests/routes/key.test.js -v
```

预期：FAIL

- [ ] **Step 3: 实现 /api/key 路由**

`server/src/routes/key.js`:

```javascript
const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const { encrypt } = require('../services/crypto');

const prisma = new PrismaClient();
router.use(auth);

router.get('/', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { open_id: req.openId }, select: { encrypted_api_key: true }
  });
  res.json({ configured: !!(user?.encrypted_api_key) });
});

router.post('/', async (req, res) => {
  const { api_key } = req.body;
  if (!api_key) return res.status(400).json({ error: 'api_key required' });
  const encrypted_api_key = encrypt(api_key);
  await prisma.user.upsert({
    where: { open_id: req.openId },
    update: { encrypted_api_key },
    create: { open_id: req.openId, encrypted_api_key }
  });
  res.json({ ok: true });
});

module.exports = router;
```

- [ ] **Step 4: 运行测试确认通过**

```bash
npx jest tests/routes/key.test.js -v
```

预期：4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/key.js server/tests/routes/key.test.js
git commit -m "feat: add /api/key routes for encrypted API key storage"
```

---

## Task 6: 报销规定服务 + 种子数据 + `/api/validate` 路由

**Files:**
- Create: `server/src/services/rules.js`
- Create: `server/scripts/seed-rules.js`
- Modify: `server/src/routes/validate.js`
- Create: `server/tests/services/rules.test.js`
- Create: `server/tests/routes/validate.test.js`

**Interfaces:**
- Consumes: Prisma `ReimbursementRule`
- Produces:
  - `rules.validate(type: string, amount: number): Promise<{ warnings: string[], passed: boolean }>`
  - `POST /api/validate`（auth 必须）body: `{ type: string, amount: number }` → `{ warnings: string[], passed: boolean }`

- [ ] **Step 1: 写 rules.test.js 失败测试**

`server/tests/services/rules.test.js`:

```javascript
jest.mock('@prisma/client', () => {
  const mockPrisma = { reimbursementRule: { findFirst: jest.fn() } };
  return { PrismaClient: jest.fn(() => mockPrisma) };
});

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { validate } = require('../../src/services/rules');

beforeEach(() => prisma.reimbursementRule.findFirst.mockReset());

test('returns passed:true and conforming message when within limit', async () => {
  prisma.reimbursementRule.findFirst.mockResolvedValue({ category: '交通费', max_amount: '100.00' });
  const result = await validate('交通费', 68);
  expect(result.passed).toBe(true);
  expect(result.warnings[0]).toContain('符合规定');
});

test('returns passed:true and over-limit warning when exceeds limit', async () => {
  prisma.reimbursementRule.findFirst.mockResolvedValue({ category: '交通费', max_amount: '100.00' });
  const result = await validate('交通费', 150);
  expect(result.passed).toBe(true);
  expect(result.warnings[0]).toContain('超出');
});

test('returns passed:true and not-found notice when category unknown', async () => {
  prisma.reimbursementRule.findFirst.mockResolvedValue(null);
  const result = await validate('未知类型', 50);
  expect(result.passed).toBe(true);
  expect(result.warnings[0]).toContain('未找到');
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx jest tests/services/rules.test.js -v
```

预期：FAIL

- [ ] **Step 3: 实现 rules.js**

`server/src/services/rules.js`:

```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function validate(type, amount) {
  const rule = await prisma.reimbursementRule.findFirst({ where: { category: type } });
  if (!rule) return { passed: true, warnings: [`未找到"${type}"的报销规定，请联系管理员确认`] };
  const limit = parseFloat(rule.max_amount);
  if (amount > limit) {
    return { passed: true, warnings: [`${type}单次上限 ${limit} 元，本次 ${amount} 元超出限额，审批人将收到提示`] };
  }
  return { passed: true, warnings: [`${type}单次上限 ${limit} 元，本次 ${amount} 元符合规定 ✓`] };
}

module.exports = { validate };
```

- [ ] **Step 4: 运行 rules 测试确认通过**

```bash
npx jest tests/services/rules.test.js -v
```

预期：3 tests PASS

- [ ] **Step 5: 写 validate route 失败测试**

`server/tests/routes/validate.test.js`:

```javascript
jest.mock('../../src/services/rules', () => ({ validate: jest.fn() }));
process.env.JWT_SECRET = 'test-secret';

const { validate } = require('../../src/services/rules');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../../src/app');
const token = jwt.sign({ open_id: 'ou_test' }, 'test-secret');

beforeEach(() => validate.mockReset());

test('POST /api/validate returns validation result', async () => {
  validate.mockResolvedValue({ passed: true, warnings: ['符合规定 ✓'] });
  const res = await request(app)
    .post('/api/validate').set('Authorization', `Bearer ${token}`).send({ type: '交通费', amount: 68 });
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ passed: true, warnings: ['符合规定 ✓'] });
  expect(validate).toHaveBeenCalledWith('交通费', 68);
});

test('POST /api/validate returns 400 if amount missing', async () => {
  const res = await request(app)
    .post('/api/validate').set('Authorization', `Bearer ${token}`).send({ type: '交通费' });
  expect(res.status).toBe(400);
});
```

- [ ] **Step 6: 实现 /api/validate 路由**

`server/src/routes/validate.js`:

```javascript
const router = require('express').Router();
const auth = require('../middleware/auth');
const { validate } = require('../services/rules');

router.use(auth);

router.post('/', async (req, res) => {
  const { type, amount } = req.body;
  if (!type || amount == null) return res.status(400).json({ error: 'type and amount required' });
  const result = await validate(type, Number(amount));
  res.json(result);
});

module.exports = router;
```

- [ ] **Step 7: 运行 validate route 测试确认通过**

```bash
npx jest tests/routes/validate.test.js -v
```

预期：2 tests PASS

- [ ] **Step 8: 写种子脚本**

`server/scripts/seed-rules.js`:

```javascript
require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const rules = [
  { category: '交通费',   max_amount: 100,  description: '市内交通（打车/地铁/公交）单次上限 100 元' },
  { category: '餐饮费',   max_amount: 200,  description: '工作餐/客户招待单次上限 200 元' },
  { category: '住宿费',   max_amount: 500,  description: '出差住宿单晚上限 500 元' },
  { category: '通讯费',   max_amount: 200,  description: '手机话费每月上限 200 元' },
  { category: '办公用品', max_amount: 300,  description: '日常办公耗材单次上限 300 元' }
];

async function main() {
  for (const rule of rules) {
    const existing = await prisma.reimbursementRule.findFirst({ where: { category: rule.category } });
    if (existing) {
      await prisma.reimbursementRule.update({ where: { id: existing.id }, data: rule });
    } else {
      await prisma.reimbursementRule.create({ data: rule });
    }
  }
  console.log('Rules seeded successfully');
}

main().finally(() => prisma.$disconnect());
```

- [ ] **Step 9: 运行种子脚本**

```bash
cd server && node scripts/seed-rules.js
```

预期输出：`Rules seeded successfully`

- [ ] **Step 10: Commit**

```bash
git add server/src/services/rules.js server/src/routes/validate.js server/scripts/seed-rules.js server/tests/
git commit -m "feat: add rules validation service, /api/validate route, and seed script"
```

---

## Task 7: LLM 服务 + `/api/extract` 路由

**Files:**
- Create: `server/src/services/llm.js`
- Modify: `server/src/routes/extract.js`
- Create: `server/tests/routes/extract.test.js`

**Interfaces:**
- Consumes: Prisma `User`（读取加密 Key），`decrypt(cipherJson: string): string`，`auth` middleware
- Produces:
  - `POST /api/extract`（auth 必须）
    - 文字模式 body: `{ content_type: "text", content: string }`
    - 图片模式 body: `{ content_type: "image", content: string }`（content = base64 data URL，如 `data:image/jpeg;base64,...`）
    - Response: `{ date: string, amount: number, type: string, vendor: string, reason: string }`

- [ ] **Step 1: 写失败测试**

`server/tests/routes/extract.test.js`:

```javascript
jest.mock('@prisma/client', () => {
  const mockPrisma = { user: { findUnique: jest.fn() } };
  return { PrismaClient: jest.fn(() => mockPrisma) };
});
jest.mock('openai');

process.env.ENCRYPT_SECRET = Buffer.from('a'.repeat(32)).toString('base64');
process.env.JWT_SECRET = 'test-secret';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const OpenAI = require('openai');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const { encrypt } = require('../../src/services/crypto');
const app = require('../../src/app');

const token = jwt.sign({ open_id: 'ou_test' }, 'test-secret');
const mockCreate = jest.fn();

beforeEach(() => {
  prisma.user.findUnique.mockReset();
  mockCreate.mockReset();
  OpenAI.mockImplementation(() => ({ chat: { completions: { create: mockCreate } } }));
});

const mockExtracted = { date: '2026-06-29', amount: 68, type: '交通费', vendor: '滴滴出行', reason: '拜访客户' };

test('POST /api/extract text mode returns extracted fields', async () => {
  prisma.user.findUnique.mockResolvedValue({ encrypted_api_key: encrypt('sk-or-v1-test') });
  mockCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(mockExtracted) } }] });
  const res = await request(app)
    .post('/api/extract').set('Authorization', `Bearer ${token}`)
    .send({ content_type: 'text', content: '昨天打车去客户那里，花了68块，滴滴出行' });
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject(mockExtracted);
});

test('POST /api/extract returns 400 if content_type invalid', async () => {
  const res = await request(app)
    .post('/api/extract').set('Authorization', `Bearer ${token}`)
    .send({ content_type: 'invalid', content: 'test' });
  expect(res.status).toBe(400);
});

test('POST /api/extract returns 403 if user has no API key configured', async () => {
  prisma.user.findUnique.mockResolvedValue(null);
  const res = await request(app)
    .post('/api/extract').set('Authorization', `Bearer ${token}`)
    .send({ content_type: 'text', content: 'test' });
  expect(res.status).toBe(403);
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx jest tests/routes/extract.test.js -v
```

预期：FAIL

- [ ] **Step 3: 实现 llm.js**

`server/src/services/llm.js`:

```javascript
const OpenAI = require('openai');

const SYSTEM_PROMPT = `你是报销信息提取助手。从用户输入（文字或票据图片）中提取报销信息，只返回 JSON，不含任何其他内容。

格式：
{
  "date": "YYYY-MM-DD",
  "amount": 数字（人民币元，不含符号）,
  "type": "交通费|餐饮费|住宿费|通讯费|办公用品|其他 之一",
  "vendor": "商家或平台名称",
  "reason": "报销事由（一句话）"
}

无法确定时：日期用今天，amount 用 0，其余用空字符串。`;

async function extract(apiKey, contentType, content) {
  const client = new OpenAI({ apiKey, baseURL: 'https://openrouter.ai/api/v1' });
  const userMessage = contentType === 'text'
    ? { role: 'user', content }
    : { role: 'user', content: [
        { type: 'image_url', image_url: { url: content } },
        { type: 'text', text: '请识别这张票据并提取报销信息。' }
      ]};

  const response = await client.chat.completions.create({
    model: 'google/gemini-2.0-flash-001',
    messages: [{ role: 'system', content: SYSTEM_PROMPT }, userMessage]
  });

  const raw = response.choices[0].message.content.trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('LLM did not return valid JSON');
  return JSON.parse(match[0]);
}

module.exports = { extract };
```

- [ ] **Step 4: 实现 /api/extract 路由**

`server/src/routes/extract.js`:

```javascript
const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const { decrypt } = require('../services/crypto');
const { extract } = require('../services/llm');

const prisma = new PrismaClient();
router.use(auth);

router.post('/', async (req, res) => {
  const { content_type, content } = req.body;
  if (!['text', 'image'].includes(content_type) || !content) {
    return res.status(400).json({ error: 'content_type must be "text" or "image", and content is required' });
  }
  const user = await prisma.user.findUnique({ where: { open_id: req.openId } });
  if (!user?.encrypted_api_key) {
    return res.status(403).json({ error: 'OpenRouter API key not configured. Please set it in settings.' });
  }
  const apiKey = decrypt(user.encrypted_api_key);
  const result = await extract(apiKey, content_type, content);
  res.json(result);
});

module.exports = router;
```

- [ ] **Step 5: 运行测试确认通过**

```bash
npx jest tests/routes/extract.test.js -v
```

预期：3 tests PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/services/llm.js server/src/routes/extract.js server/tests/routes/extract.test.js
git commit -m "feat: add LLM service and /api/extract route for text and OCR extraction"
```

---

## Task 8: 飞书审批提交 + `/api/submit` 路由

**Files:**
- Modify: `server/src/services/feishu.js`（添加 `submitApproval`）
- Modify: `server/src/routes/submit.js`
- Create: `server/tests/routes/submit.test.js`

**Interfaces:**
- Consumes: `FEISHU_APPROVAL_CODE` from env，`auth` middleware
- Produces:
  - `feishu.submitApproval(openId: string, fields: { date, amount, type, vendor, reason }): Promise<{ instance_code: string }>`
  - `POST /api/submit`（auth 必须）body: `{ date: string, amount: number, type: string, vendor: string, reason: string }` → `{ instance_code: string, success: true }`

- [ ] **Step 1: 写失败测试**

`server/tests/routes/submit.test.js`:

```javascript
jest.mock('../../src/services/feishu', () => ({ getOpenId: jest.fn(), submitApproval: jest.fn() }));
process.env.JWT_SECRET = 'test-secret';

const feishu = require('../../src/services/feishu');
const jwt = require('jsonwebtoken');
const request = require('supertest');
const app = require('../../src/app');

const token = jwt.sign({ open_id: 'ou_test' }, 'test-secret');
const validBody = { date: '2026-06-29', amount: 68, type: '交通费', vendor: '滴滴出行', reason: '拜访客户' };

beforeEach(() => feishu.submitApproval.mockReset());

test('POST /api/submit calls submitApproval and returns instance_code', async () => {
  feishu.submitApproval.mockResolvedValue({ instance_code: 'INSTANCE_001' });
  const res = await request(app)
    .post('/api/submit').set('Authorization', `Bearer ${token}`).send(validBody);
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ instance_code: 'INSTANCE_001', success: true });
  expect(feishu.submitApproval).toHaveBeenCalledWith('ou_test', validBody);
});

test('POST /api/submit returns 400 if required fields missing', async () => {
  const res = await request(app)
    .post('/api/submit').set('Authorization', `Bearer ${token}`).send({ date: '2026-06-29' });
  expect(res.status).toBe(400);
});

test('POST /api/submit returns 502 if feishu API fails', async () => {
  feishu.submitApproval.mockRejectedValue(new Error('Feishu error'));
  const res = await request(app)
    .post('/api/submit').set('Authorization', `Bearer ${token}`).send(validBody);
  expect(res.status).toBe(502);
});
```

- [ ] **Step 2: 运行测试确认失败**

```bash
npx jest tests/routes/submit.test.js -v
```

预期：FAIL

- [ ] **Step 3: 在 feishu.js 末尾添加 submitApproval**

在 `server/src/services/feishu.js` 的 `module.exports` 行之前插入：

```javascript
async function submitApproval(openId, { date, amount, type, vendor, reason }) {
  const token = await getAppAccessToken();

  // ⚠️ 以下 widget id（date/amount/type/vendor/reason）为占位符。
  // 实施前须在飞书审批管理后台查找真实表单控件 ID 并替换。
  const form = JSON.stringify([
    { id: 'date',   type: 'date',  value: date },
    { id: 'amount', type: 'money', value: String(amount) },
    { id: 'type',   type: 'input', value: type },
    { id: 'vendor', type: 'input', value: vendor },
    { id: 'reason', type: 'input', value: reason }
  ]);

  const res = await post(
    'https://open.feishu.cn/open-apis/approval/v4/instances',
    { approval_code: process.env.FEISHU_APPROVAL_CODE, open_id: openId, form },
    { Authorization: `Bearer ${token}` }
  );

  if (res.code !== 0) throw new Error(`Feishu approval failed: ${res.msg}`);
  return { instance_code: res.data.instance_code };
}
```

将 `module.exports` 更新为：

```javascript
module.exports = { getOpenId, submitApproval };
```

- [ ] **Step 4: 实现 /api/submit 路由**

`server/src/routes/submit.js`:

```javascript
const router = require('express').Router();
const auth = require('../middleware/auth');
const feishu = require('../services/feishu');

router.use(auth);

router.post('/', async (req, res) => {
  const { date, amount, type, vendor, reason } = req.body;
  if (!date || amount == null || !type || !vendor || !reason) {
    return res.status(400).json({ error: 'All fields required: date, amount, type, vendor, reason' });
  }
  try {
    const result = await feishu.submitApproval(req.openId, { date, amount, type, vendor, reason });
    res.json({ ...result, success: true });
  } catch (err) {
    res.status(502).json({ error: 'Failed to submit to Feishu approval', detail: err.message });
  }
});

module.exports = router;
```

- [ ] **Step 5: 运行测试确认通过**

```bash
npx jest tests/routes/submit.test.js -v
```

预期：3 tests PASS

- [ ] **Step 6: 运行全部后端测试**

```bash
cd server && npx jest -v
```

预期：所有测试 PASS，总计 ≥ 18 个

- [ ] **Step 7: Commit**

```bash
git add server/src/services/feishu.js server/src/routes/submit.js server/tests/routes/submit.test.js
git commit -m "feat: add submitApproval to feishu service and /api/submit route"
```

---

## Task 9: 飞书小程序初始化 + 工具函数

**Files:**
- Create: `miniapp/app.js`
- Create: `miniapp/app.json`
- Create: `miniapp/app.ttss`
- Create: `miniapp/config.js`
- Create: `miniapp/utils/request.js`
- Create: `miniapp/utils/auth.js`

**Interfaces:**
- Produces:
  - `request({ url, method?, data? }): Promise<any>` — 自动附加 `Authorization: Bearer <token>` header
  - `getToken(): Promise<string>` — 读缓存或调 `tt.login()` 重新登录

- [ ] **Step 1: 创建小程序目录结构**

```bash
mkdir -p miniapp/utils \
  miniapp/pages/index miniapp/pages/input miniapp/pages/ocr \
  miniapp/pages/preview miniapp/pages/success miniapp/pages/settings
```

- [ ] **Step 2: 写 config.js**

`miniapp/config.js`:

```javascript
const config = {
  BASE_URL: 'https://your-server.com'  // 部署后替换为实际后端地址
};

export default config;
```

- [ ] **Step 3: 写 utils/auth.js**

`miniapp/utils/auth.js`:

```javascript
import config from '../config';

const TOKEN_KEY = 'session_token';

export function saveToken(token) { tt.setStorageSync(TOKEN_KEY, token); }

export function getCachedToken() {
  try { return tt.getStorageSync(TOKEN_KEY) || null; } catch { return null; }
}

export function getToken() {
  const cached = getCachedToken();
  return cached ? Promise.resolve(cached) : login();
}

export function login() {
  return new Promise((resolve, reject) => {
    tt.login({
      success: ({ code }) => {
        tt.request({
          url: config.BASE_URL + '/api/auth',
          method: 'POST',
          data: { code },
          header: { 'Content-Type': 'application/json' },
          success: (res) => {
            if (res.data?.token) { saveToken(res.data.token); resolve(res.data.token); }
            else reject(new Error('Login failed'));
          },
          fail: reject
        });
      },
      fail: reject
    });
  });
}
```

- [ ] **Step 4: 写 utils/request.js**

`miniapp/utils/request.js`:

```javascript
import config from '../config';
import { getToken } from './auth';

export function request({ url, method = 'GET', data } = {}) {
  return new Promise(async (resolve, reject) => {
    const token = await getToken().catch(() => null);
    tt.request({
      url: config.BASE_URL + url,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      success: (res) => {
        if (res.statusCode >= 400) reject(new Error(res.data?.error || `HTTP ${res.statusCode}`));
        else resolve(res.data);
      },
      fail: reject
    });
  });
}
```

- [ ] **Step 5: 写 app.json**

`miniapp/app.json`:

```json
{
  "pages": [
    "pages/index/index",
    "pages/settings/index",
    "pages/input/index",
    "pages/ocr/index",
    "pages/preview/index",
    "pages/success/index"
  ],
  "window": {
    "navigationBarTitleText": "智能报销",
    "navigationBarBackgroundColor": "#1a73e8",
    "navigationBarTextStyle": "white"
  }
}
```

- [ ] **Step 6: 写 app.js**

`miniapp/app.js`:

```javascript
App({
  globalData: { extractedData: null, instanceCode: null },
  onLaunch() {}
});
```

- [ ] **Step 7: 写 app.ttss**

`miniapp/app.ttss`:

```css
page { background: #f5f5f5; font-family: -apple-system, sans-serif; }
.btn-primary {
  background: #1a73e8; color: #fff; border-radius: 8rpx;
  font-size: 32rpx; padding: 24rpx 0; text-align: center;
  width: 100%; box-sizing: border-box; margin-top: 32rpx;
}
.card {
  background: #fff; border-radius: 16rpx; padding: 32rpx;
  margin: 24rpx; box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.06);
}
.warning-text { color: #f59e0b; font-size: 26rpx; margin-top: 8rpx; }
.error-text { color: #ef4444; font-size: 26rpx; margin-top: 16rpx; }
.loading-text { color: #1a73e8; font-size: 30rpx; text-align: center; padding: 32rpx; }
```

- [ ] **Step 8: 在飞书开发者工具验证项目可加载**

打开飞书开发者工具 → 新建项目 → 选择 `miniapp/` 目录 → 确认控制台无报错。

- [ ] **Step 9: Commit**

```bash
git add miniapp/
git commit -m "feat: initialize feishu miniapp scaffold with auth utils and request wrapper"
```

---

## Task 10: Settings 页面（API Key 设置）

**Files:**
- Create: `miniapp/pages/settings/index.js`
- Create: `miniapp/pages/settings/index.ttml`
- Create: `miniapp/pages/settings/index.ttss`

**Interfaces:**
- Consumes: `request({ url: '/api/key', method: 'POST', data: { api_key } })`
- Produces: 保存成功后 `tt.redirectTo({ url: '/pages/index/index' })`

- [ ] **Step 1: 写 settings/index.ttml**

```html
<view class="card">
  <view class="title">配置 OpenRouter API Key</view>
  <view class="desc">Key 将加密保存在服务器，只需配置一次。前往 openrouter.ai 获取你的 Key。</view>
  <input
    class="input"
    type="text"
    placeholder="sk-or-v1-..."
    value="{{apiKey}}"
    bindinput="onInput"
    password="{{true}}"
  />
  <view class="btn-primary" bindtap="onSave" tt:if="{{!loading}}">保存</view>
  <view class="loading-text" tt:if="{{loading}}">保存中...</view>
  <view class="error-text" tt:if="{{error}}">{{error}}</view>
</view>
```

- [ ] **Step 2: 写 settings/index.ttss**

```css
.title { font-size: 36rpx; font-weight: 600; margin-bottom: 16rpx; }
.desc { font-size: 26rpx; color: #666; margin-bottom: 32rpx; line-height: 1.6; }
.input {
  border: 2rpx solid #ddd; border-radius: 8rpx; padding: 20rpx;
  font-size: 28rpx; margin-bottom: 8rpx; width: 100%; box-sizing: border-box;
}
```

- [ ] **Step 3: 写 settings/index.js**

```javascript
import { request } from '../../utils/request';

Page({
  data: { apiKey: '', loading: false, error: '' },
  onInput(e) { this.setData({ apiKey: e.detail.value }); },
  async onSave() {
    const { apiKey } = this.data;
    if (!apiKey.trim()) { this.setData({ error: '请输入 API Key' }); return; }
    this.setData({ loading: true, error: '' });
    try {
      await request({ url: '/api/key', method: 'POST', data: { api_key: apiKey.trim() } });
      tt.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => tt.redirectTo({ url: '/pages/index/index' }), 1000);
    } catch (err) {
      this.setData({ error: err.message || '保存失败，请重试' });
    } finally {
      this.setData({ loading: false });
    }
  }
});
```

- [ ] **Step 4: 在模拟器验证**

打开 settings 页 → 输入字符串 → 点击保存 → Network 面板确认请求发出 → 跳转首页。

- [ ] **Step 5: Commit**

```bash
git add miniapp/pages/settings/
git commit -m "feat: add settings page for OpenRouter API key configuration"
```

---

## Task 11: Index 页面（首页入口）

**Files:**
- Create: `miniapp/pages/index/index.js`
- Create: `miniapp/pages/index/index.ttml`
- Create: `miniapp/pages/index/index.ttss`

**Interfaces:**
- Consumes: `request({ url: '/api/key' })` → `{ configured: boolean }`；`getToken()`
- Produces: 两个按钮跳转 `/pages/input/index` 和 `/pages/ocr/index`；未配置 Key 跳转 settings

- [ ] **Step 1: 写 index/index.ttml**

```html
<view class="container">
  <view class="header">
    <view class="app-title">智能报销</view>
    <view class="app-sub">选择报销方式</view>
  </view>
  <view class="card entry-card" bindtap="goInput">
    <view class="entry-icon">✏️</view>
    <view class="entry-label">自然语言输入</view>
    <view class="entry-desc">用文字描述报销内容</view>
  </view>
  <view class="card entry-card" bindtap="goOcr">
    <view class="entry-icon">📷</view>
    <view class="entry-label">拍照识别票据</view>
    <view class="entry-desc">拍摄或上传发票照片</view>
  </view>
</view>
```

- [ ] **Step 2: 写 index/index.ttss**

```css
.container { padding: 48rpx 24rpx; }
.header { text-align: center; margin-bottom: 48rpx; }
.app-title { font-size: 48rpx; font-weight: 700; color: #1a73e8; }
.app-sub { font-size: 28rpx; color: #999; margin-top: 8rpx; }
.entry-card { display: flex; flex-direction: column; align-items: center; padding: 48rpx; margin-bottom: 24rpx; }
.entry-icon { font-size: 80rpx; margin-bottom: 16rpx; }
.entry-label { font-size: 36rpx; font-weight: 600; margin-bottom: 8rpx; }
.entry-desc { font-size: 26rpx; color: #666; }
```

- [ ] **Step 3: 写 index/index.js**

```javascript
import { request } from '../../utils/request';
import { getToken } from '../../utils/auth';

Page({
  async onShow() {
    await getToken().catch(() => null);
    try {
      const res = await request({ url: '/api/key' });
      if (!res.configured) tt.redirectTo({ url: '/pages/settings/index' });
    } catch {
      tt.redirectTo({ url: '/pages/settings/index' });
    }
  },
  goInput() { tt.navigateTo({ url: '/pages/input/index' }); },
  goOcr()   { tt.navigateTo({ url: '/pages/ocr/index' }); }
});
```

- [ ] **Step 4: 在模拟器验证**

首次进入（无 Key）→ 自动跳转 settings。配置 Key 后返回 → 显示两个入口按钮。

- [ ] **Step 5: Commit**

```bash
git add miniapp/pages/index/
git commit -m "feat: add index page with entry to input and OCR flows"
```

---

## Task 12: Input 页面（自然语言输入）

**Files:**
- Create: `miniapp/pages/input/index.js`
- Create: `miniapp/pages/input/index.ttml`
- Create: `miniapp/pages/input/index.ttss`

**Interfaces:**
- Consumes:
  - `request({ url: '/api/extract', method: 'POST', data: { content_type: 'text', content } })` → `{ date, amount, type, vendor, reason }`
  - `request({ url: '/api/validate', method: 'POST', data: { type, amount } })` → `{ warnings: string[], passed: boolean }`
- Produces: `getApp().globalData.extractedData = { date, amount, type, vendor, reason, warnings }`，导航到 `/pages/preview/index`

- [ ] **Step 1: 写 input/index.ttml**

```html
<view class="container">
  <view class="card">
    <view class="label">描述你的报销内容</view>
    <textarea
      class="textarea"
      placeholder="例：昨天打车去客户公司，花了68元，滴滴出行"
      value="{{text}}"
      bindinput="onInput"
      maxlength="500"
    />
    <view class="char-count">{{text.length}}/500</view>
  </view>
  <view class="btn-primary" bindtap="onSubmit" tt:if="{{!loading}}">识别报销信息</view>
  <view class="loading-text" tt:if="{{loading}}">AI 识别中...</view>
  <view class="error-text" tt:if="{{error}}">{{error}}</view>
</view>
```

- [ ] **Step 2: 写 input/index.ttss**

```css
.container { padding: 24rpx; }
.label { font-size: 30rpx; font-weight: 600; margin-bottom: 20rpx; }
.textarea {
  width: 100%; min-height: 240rpx; border: 2rpx solid #ddd;
  border-radius: 8rpx; padding: 20rpx; font-size: 28rpx; box-sizing: border-box;
}
.char-count { text-align: right; font-size: 24rpx; color: #999; margin-top: 8rpx; }
```

- [ ] **Step 3: 写 input/index.js**

```javascript
import { request } from '../../utils/request';

Page({
  data: { text: '', loading: false, error: '' },
  onInput(e) { this.setData({ text: e.detail.value }); },
  async onSubmit() {
    const { text } = this.data;
    if (!text.trim()) { this.setData({ error: '请输入报销内容描述' }); return; }
    this.setData({ loading: true, error: '' });
    try {
      const extracted = await request({
        url: '/api/extract', method: 'POST', data: { content_type: 'text', content: text.trim() }
      });
      const validation = await request({
        url: '/api/validate', method: 'POST', data: { type: extracted.type, amount: extracted.amount }
      });
      getApp().globalData.extractedData = { ...extracted, warnings: validation.warnings };
      tt.navigateTo({ url: '/pages/preview/index' });
    } catch (err) {
      this.setData({ error: err.message || 'AI 识别失败，请重试' });
    } finally {
      this.setData({ loading: false });
    }
  }
});
```

- [ ] **Step 4: 在模拟器验证**

输入「昨天打车去客户那里，花了68块，滴滴出行」→ 点击识别 → 请求发出 → 跳转 preview。

- [ ] **Step 5: Commit**

```bash
git add miniapp/pages/input/
git commit -m "feat: add input page for natural language reimbursement entry"
```

---

## Task 13: OCR 页面（拍照/上传票据）

**Files:**
- Create: `miniapp/pages/ocr/index.js`
- Create: `miniapp/pages/ocr/index.ttml`
- Create: `miniapp/pages/ocr/index.ttss`

**Interfaces:**
- Consumes: `tt.chooseImage`，`tt.getFileSystemManager().readFileSync(path, 'base64')`
  - `request({ url: '/api/extract', method: 'POST', data: { content_type: 'image', content: dataUrl } })` → `{ date, amount, type, vendor, reason }`
  - `request({ url: '/api/validate', method: 'POST', data: { type, amount } })` → `{ warnings, passed }`
- Produces: 同 Task 12，写入 `getApp().globalData.extractedData`，导航到 preview

- [ ] **Step 1: 写 ocr/index.ttml**

```html
<view class="container">
  <view class="card upload-area" bindtap="chooseImage" tt:if="{{!imageUrl}}">
    <view class="upload-icon">📷</view>
    <view class="upload-label">点击拍照或选择票据图片</view>
  </view>
  <view class="card preview-area" tt:if="{{imageUrl}}">
    <image src="{{imageUrl}}" mode="widthFix" class="preview-image" />
    <view class="reselect" bindtap="chooseImage">重新选择</view>
  </view>
  <view class="btn-primary" bindtap="onSubmit" tt:if="{{imageUrl && !loading}}">识别票据</view>
  <view class="loading-text" tt:if="{{loading}}">AI 识别中...</view>
  <view class="error-text" tt:if="{{error}}">{{error}}</view>
</view>
```

- [ ] **Step 2: 写 ocr/index.ttss**

```css
.container { padding: 24rpx; }
.upload-area { display: flex; flex-direction: column; align-items: center; padding: 80rpx 0; }
.upload-icon { font-size: 100rpx; margin-bottom: 20rpx; }
.upload-label { font-size: 30rpx; color: #666; }
.preview-area { padding: 0; overflow: hidden; }
.preview-image { width: 100%; border-radius: 16rpx; }
.reselect { text-align: center; color: #1a73e8; font-size: 28rpx; padding: 20rpx; }
```

- [ ] **Step 3: 写 ocr/index.js**

```javascript
import { request } from '../../utils/request';

Page({
  data: { imageUrl: '', loading: false, error: '' },
  chooseImage() {
    tt.chooseImage({
      count: 1, sourceType: ['album', 'camera'],
      success: (res) => this.setData({ imageUrl: res.tempFilePaths[0], error: '' })
    });
  },
  async onSubmit() {
    const { imageUrl } = this.data;
    if (!imageUrl) return;
    this.setData({ loading: true, error: '' });
    try {
      const fs = tt.getFileSystemManager();
      const base64 = fs.readFileSync(imageUrl, 'base64');
      const dataUrl = `data:image/jpeg;base64,${base64}`;
      const extracted = await request({
        url: '/api/extract', method: 'POST', data: { content_type: 'image', content: dataUrl }
      });
      const validation = await request({
        url: '/api/validate', method: 'POST', data: { type: extracted.type, amount: extracted.amount }
      });
      getApp().globalData.extractedData = { ...extracted, warnings: validation.warnings };
      tt.navigateTo({ url: '/pages/preview/index' });
    } catch (err) {
      this.setData({ error: err.message || '识别失败，请重试或改用文字输入' });
    } finally {
      this.setData({ loading: false });
    }
  }
});
```

- [ ] **Step 4: 在模拟器验证**

点击上传区 → 选择图片 → 预览显示 → 点击识别 → 跳转 preview。

- [ ] **Step 5: Commit**

```bash
git add miniapp/pages/ocr/
git commit -m "feat: add OCR page for receipt photo recognition"
```

---

## Task 14: Preview 页面（确认提交）+ Success 页面

**Files:**
- Create: `miniapp/pages/preview/index.js`
- Create: `miniapp/pages/preview/index.ttml`
- Create: `miniapp/pages/preview/index.ttss`
- Create: `miniapp/pages/success/index.js`
- Create: `miniapp/pages/success/index.ttml`
- Create: `miniapp/pages/success/index.ttss`

**Interfaces:**
- Consumes:
  - `getApp().globalData.extractedData: { date, amount, type, vendor, reason, warnings }`
  - `request({ url: '/api/submit', method: 'POST', data: { date, amount, type, vendor, reason } })` → `{ instance_code: string, success: true }`
- Produces: `getApp().globalData.instanceCode = instance_code`，`tt.redirectTo('/pages/success/index')`

- [ ] **Step 1: 写 preview/index.ttml**

```html
<view class="container">
  <view class="card">
    <view class="section-title">确认报销信息</view>
    <view class="field-row">
      <view class="field-label">日期</view>
      <input class="field-input" value="{{data.date}}" bindinput="onChange" data-key="date" />
    </view>
    <view class="field-row">
      <view class="field-label">金额（元）</view>
      <input class="field-input" value="{{data.amount}}" type="digit" bindinput="onChange" data-key="amount" />
    </view>
    <view class="field-row">
      <view class="field-label">费用类型</view>
      <input class="field-input" value="{{data.type}}" bindinput="onChange" data-key="type" />
    </view>
    <view class="field-row">
      <view class="field-label">商家/平台</view>
      <input class="field-input" value="{{data.vendor}}" bindinput="onChange" data-key="vendor" />
    </view>
    <view class="field-row">
      <view class="field-label">报销事由</view>
      <input class="field-input" value="{{data.reason}}" bindinput="onChange" data-key="reason" />
    </view>
  </view>
  <view class="card warnings-card" tt:if="{{warnings.length > 0}}">
    <view class="warnings-title">⚠️ 规定提示</view>
    <view class="warning-text" tt:for="{{warnings}}" tt:key="index">{{item}}</view>
  </view>
  <view class="btn-primary" bindtap="onSubmit" tt:if="{{!loading}}">提交至飞书审批</view>
  <view class="loading-text" tt:if="{{loading}}">提交中...</view>
  <view class="error-text" tt:if="{{error}}">{{error}}</view>
</view>
```

- [ ] **Step 2: 写 preview/index.ttss**

```css
.container { padding: 24rpx; }
.section-title { font-size: 32rpx; font-weight: 600; margin-bottom: 24rpx; }
.field-row { display: flex; align-items: center; padding: 16rpx 0; border-bottom: 1rpx solid #f0f0f0; }
.field-label { width: 160rpx; font-size: 28rpx; color: #666; flex-shrink: 0; }
.field-input { flex: 1; font-size: 28rpx; }
.warnings-card { margin-top: 0; }
.warnings-title { font-size: 28rpx; font-weight: 600; color: #f59e0b; margin-bottom: 12rpx; }
```

- [ ] **Step 3: 写 preview/index.js**

```javascript
import { request } from '../../utils/request';

Page({
  data: { data: {}, warnings: [], loading: false, error: '' },
  onLoad() {
    const { extractedData } = getApp().globalData;
    if (!extractedData) { tt.navigateBack(); return; }
    const { warnings = [], ...fields } = extractedData;
    this.setData({ data: fields, warnings });
  },
  onChange(e) {
    this.setData({ [`data.${e.currentTarget.dataset.key}`]: e.detail.value });
  },
  async onSubmit() {
    const { data } = this.data;
    this.setData({ loading: true, error: '' });
    try {
      const result = await request({
        url: '/api/submit', method: 'POST',
        data: { ...data, amount: Number(data.amount) }
      });
      getApp().globalData.instanceCode = result.instance_code;
      tt.redirectTo({ url: '/pages/success/index' });
    } catch (err) {
      this.setData({ error: err.message || '提交失败，请重试' });
    } finally {
      this.setData({ loading: false });
    }
  }
});
```

- [ ] **Step 4: 写 success/index.ttml**

```html
<view class="container">
  <view class="success-icon">✅</view>
  <view class="success-title">报销申请已提交</view>
  <view class="instance-code">审批编号：{{instanceCode}}</view>
  <view class="hint">请在飞书「审批」中查看进度</view>
  <view class="btn-primary" bindtap="goHome">返回首页</view>
</view>
```

- [ ] **Step 5: 写 success/index.ttss**

```css
.container { padding: 80rpx 48rpx; text-align: center; }
.success-icon { font-size: 120rpx; margin-bottom: 32rpx; }
.success-title { font-size: 44rpx; font-weight: 700; color: #16a34a; margin-bottom: 16rpx; }
.instance-code { font-size: 26rpx; color: #666; margin-bottom: 12rpx; }
.hint { font-size: 28rpx; color: #999; margin-bottom: 64rpx; }
```

- [ ] **Step 6: 写 success/index.js**

```javascript
Page({
  data: { instanceCode: '' },
  onLoad() {
    this.setData({ instanceCode: getApp().globalData.instanceCode || '' });
    getApp().globalData.extractedData = null;
    getApp().globalData.instanceCode = null;
  },
  goHome() { tt.redirectTo({ url: '/pages/index/index' }); }
});
```

- [ ] **Step 7: 端到端全流程验证**

在模拟器中走完整路径：
1. 首页 → 「自然语言输入」→ 输入「昨天打车去客户那里，花了68块，滴滴出行」→ 识别
2. Preview 页：确认字段正确，软提示警告正常显示
3. 点击「提交至飞书审批」
4. Success 页：显示审批编号

- [ ] **Step 8: Commit**

```bash
git add miniapp/pages/preview/ miniapp/pages/success/
git commit -m "feat: add preview and success pages, completing full reimbursement submission flow"
```

---

## 自检结果

**Spec coverage:**
- ✅ 自然语言输入 → Task 7, 12
- ✅ OCR 票据识别（多模态 LLM）→ Task 7, 13
- ✅ 报销规定软提示校验 → Task 6, 12, 13, 14
- ✅ 提交发起飞书审批 → Task 8, 14
- ✅ API Key 首次设置与 AES-256-GCM 加密存储 → Task 3, 5, 10, 11

**实施前必须获取（否则无法真实联调）：**
1. 飞书审批 `approval_code` → 填入 `server/.env` 的 `FEISHU_APPROVAL_CODE`
2. 飞书审批表单真实 widget ID → 替换 Task 8 Step 3 中的占位符
3. 云数据库 `DATABASE_URL` → 填入 `server/.env`
4. 后端部署地址 → 替换 `miniapp/config.js` 中的 `BASE_URL`
