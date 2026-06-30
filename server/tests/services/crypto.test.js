process.env.ENCRYPT_SECRET = Buffer.from('a'.repeat(32)).toString('base64');

const { encrypt, decrypt } = require('../../src/services/crypto');

test('encrypt then decrypt returns original plaintext', () => {
  const original = 'sk-or-v1-test-key-12345';
  const cipherJson = encrypt(original);
  const parsed = JSON.parse(cipherJson);
  expect(parsed).toHaveProperty('encrypted');
  expect(parsed).toHaveProperty('iv');
  expect(parsed).toHaveProperty('authTag');
  expect(decrypt(cipherJson)).toBe(original);
});

test('two encryptions of same plaintext produce different ciphertexts', () => {
  const original = 'sk-or-v1-same-key';
  expect(encrypt(original)).not.toBe(encrypt(original));
});

test('tampered ciphertext throws on decrypt', () => {
  const parsed = JSON.parse(encrypt('secret'));
  parsed.encrypted = Buffer.from('tampered').toString('base64');
  expect(() => decrypt(JSON.stringify(parsed))).toThrow();
});
