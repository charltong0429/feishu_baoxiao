const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');
const { decrypt } = require('../services/crypto');
const { extract } = require('../services/llm');

const prisma = new PrismaClient();
router.use(auth);

router.post('/', async (req, res) => {
  const { content_type, content } = req.body;
  if (!['text', 'image'].includes(content_type) || !content) {
    return res.status(400).json({ error: 'content_type must be "text" or "image", and content is required' });
  }
  const user = await prisma.user.findUnique({ where: { open_id: req.openId } });
  if (!user?.encrypted_api_key) {
    return res.status(403).json({ error: 'OpenRouter API key not configured. Please set it in settings.' });
  }
  const apiKey = decrypt(user.encrypted_api_key);
  const result = await extract(apiKey, content_type, content);
  res.json(result);
});

module.exports = router;
