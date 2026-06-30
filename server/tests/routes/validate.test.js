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
