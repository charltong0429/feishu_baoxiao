import config from '../config';

const TOKEN_KEY = 'session_token';

export function saveToken(token) { tt.setStorageSync(TOKEN_KEY, token); }

export function getCachedToken() {
  try { return tt.getStorageSync(TOKEN_KEY) || null; } catch { return null; }
}

export function getToken() {
  const cached = getCachedToken();
  return cached ? Promise.resolve(cached) : login();
}

export function login() {
  return new Promise((resolve, reject) => {
    tt.login({
      success: ({ code }) => {
        tt.request({
          url: config.BASE_URL + '/api/auth',
          method: 'POST',
          data: { code },
          header: { 'Content-Type': 'application/json' },
          success: (res) => {
            if (res.data?.token) { saveToken(res.data.token); resolve(res.data.token); }
            else reject(new Error('Login failed'));
          },
          fail: reject
        });
      },
      fail: reject
    });
  });
}
