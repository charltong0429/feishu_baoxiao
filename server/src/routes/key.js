const router = require('express').Router();
const prisma = require('../services/prisma');
const auth = require('../middleware/auth');
const { encrypt } = require('../services/crypto');
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
