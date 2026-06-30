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
