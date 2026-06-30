const crypto = require('crypto');
const ALGORITHM = 'aes-256-gcm';

function getKey() {
  return Buffer.from(process.env.ENCRYPT_SECRET, 'base64');
}

function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return JSON.stringify({
    encrypted: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64')
  });
}

function decrypt(cipherJson) {
  const { encrypted, iv, authTag } = JSON.parse(cipherJson);
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final()
  ]).toString('utf8');
}

module.exports = { encrypt, decrypt };
