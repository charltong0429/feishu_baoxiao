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
