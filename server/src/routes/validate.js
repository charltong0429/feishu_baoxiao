const router = require('express').Router();
const auth = require('../middleware/auth');
const { validate } = require('../services/rules');

router.use(auth);

router.post('/', async (req, res) => {
  const { type, amount } = req.body;
  if (!type || amount == null) return res.status(400).json({ error: 'type and amount required' });
  const result = await validate(type, Number(amount));
  res.json(result);
});

module.exports = router;
