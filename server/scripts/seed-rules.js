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
