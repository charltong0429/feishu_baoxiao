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
