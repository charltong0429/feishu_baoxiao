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
