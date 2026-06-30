require('dotenv').config();
const express = require('express');
const app = express();

app.use(express.json({ limit: '20mb' }));

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/key',      require('./routes/key'));
app.use('/api/extract',  require('./routes/extract'));
app.use('/api/validate', require('./routes/validate'));
app.use('/api/submit',   require('./routes/submit'));

app.get('/health', (req, res) => res.json({ ok: true }));

module.exports = app;
