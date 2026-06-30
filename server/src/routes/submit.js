const router = require('express').Router();
const auth = require('../middleware/auth');
const feishu = require('../services/feishu');

router.use(auth);

router.post('/', async (req, res) => {
  const { date, amount, type, vendor, reason } = req.body;
  if (!date || amount == null || !type || !vendor || !reason) {
    return res.status(400).json({ error: 'All fields required: date, amount, type, vendor, reason' });
  }
  try {
    const result = await feishu.submitApproval(req.openId, { date, amount, type, vendor, reason });
    res.json({ ...result, success: true });
  } catch (err) {
    res.status(502).json({ error: 'Failed to submit to Feishu approval', detail: err.message });
  }
});

module.exports = router;
