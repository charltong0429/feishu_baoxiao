const prisma = require('./prisma');

async function validate(type, amount) {
  const rule = await prisma.reimbursementRule.findFirst({ where: { category: type } });
  if (!rule) return { passed: true, warnings: [`未找到"${type}"的报销规定，请联系管理员确认`] };
  const limit = parseFloat(rule.max_amount);
  if (amount > limit) {
    return { passed: true, warnings: [`${type}单次上限 ${limit} 元，本次 ${amount} 元超出限额，审批人将收到提示`] };
  }
  return { passed: true, warnings: [] };
}

module.exports = { validate };
