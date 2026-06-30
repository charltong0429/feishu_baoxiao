const router = require('express').Router();
router.all('/', (req, res) => res.json({ ok: true }));
module.exports = router;
