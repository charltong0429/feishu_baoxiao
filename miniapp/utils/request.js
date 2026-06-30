import config from '../config';
import { getToken } from './auth';

export function request({ url, method = 'GET', data } = {}) {
  return new Promise(async (resolve, reject) => {
    const token = await getToken().catch(() => null);
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
