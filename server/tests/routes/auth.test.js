jest.mock('../../src/services/feishu', () => ({ getOpenId: jest.fn() }));

const jwt = require('jsonwebtoken');
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
  const decoded = jwt.decode(res.body.token);
  expect(decoded.open_id).toBe('ou_test123');
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

const auth = require('../../src/middleware/auth');

describe('auth middleware', () => {
  let req, res, next;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
    req = { headers: {} };
    res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    next = jest.fn();
  });

  test('sets req.openId and calls next for valid token', () => {
    const token = jwt.sign({ open_id: 'ou_abc' }, 'test-secret');
    req.headers.authorization = `Bearer ${token}`;
    auth(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.openId).toBe('ou_abc');
  });

  test('returns 401 if no Authorization header', () => {
    auth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('returns 401 if token is invalid', () => {
    req.headers.authorization = 'Bearer invalid.token.here';
    auth(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });
});
