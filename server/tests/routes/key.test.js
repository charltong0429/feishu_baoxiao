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
