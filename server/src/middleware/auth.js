const jwt = require('jsonwebtoken');

function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Missing token' });
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET);
    req.openId = payload.open_id;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = auth;
