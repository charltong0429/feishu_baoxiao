import config from '../config';
import { getToken } from './auth';

export async function request({ url, method = 'GET', data } = {}) {
  const token = await getToken().catch(() => null);
  return new Promise((resolve, reject) => {
    tt.request({
      url: config.BASE_URL + url,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      success: (res) => {
        if (res.statusCode >= 400) reject(new Error(res.data?.error || `HTTP ${res.statusCode}`));
        else resolve(res.data);
      },
      fail: reject
    });
  });
}
