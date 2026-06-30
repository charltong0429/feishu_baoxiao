const router = require('express').Router();
const jwt = require('jsonwebtoken');
const feishu = require('../services/feishu');

router.post('/', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'code required' });
  try {
    const open_id = await feishu.getOpenId(code);
    const token = jwt.sign({ open_id }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token });
  } catch {
    res.status(401).json({ error: 'Authentication failed' });
  }
});

module.exports = router;
