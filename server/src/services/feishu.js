const https = require('https');

function post(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const { hostname, pathname } = new URL(url);
    const req = https.request(
      { hostname, path: pathname, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), ...headers } },
      (res) => { let raw = ''; res.on('data', c => raw += c); res.on('end', () => resolve(JSON.parse(raw))); }
    );
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function getAppAccessToken() {
  const res = await post(
    'https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal',
    { app_id: process.env.FEISHU_APP_ID, app_secret: process.env.FEISHU_APP_SECRET }
  );
  if (!res.app_access_token) throw new Error('Failed to get app access token');
  return res.app_access_token;
}

async function getOpenId(code) {
  const token = await getAppAccessToken();
  const res = await post(
    'https://open.feishu.cn/open-apis/mina/v2/tokenLoginValidate',
    { code },
    { Authorization: `Bearer ${token}` }
  );
  if (res.code !== 0 || !res.data?.open_id) throw new Error(`Feishu auth failed: ${res.msg}`);
  return res.data.open_id;
}

async function submitApproval(openId, { date, amount, type, vendor, reason }) {
  const token = await getAppAccessToken();

  // ⚠️ 以下 widget id（date/amount/type/vendor/reason）为占位符。
  // 实施前须在飞书审批管理后台查找真实表单控件 ID 并替换。
  const form = JSON.stringify([
    { id: 'date',   type: 'date',  value: date },
    { id: 'amount', type: 'money', value: String(amount) },
    { id: 'type',   type: 'input', value: type },
    { id: 'vendor', type: 'input', value: vendor },
    { id: 'reason', type: 'input', value: reason }
  ]);

  const res = await post(
    'https://open.feishu.cn/open-apis/approval/v4/instances',
    { approval_code: process.env.FEISHU_APPROVAL_CODE, open_id: openId, form },
    { Authorization: `Bearer ${token}` }
  );

  if (res.code !== 0) throw new Error(`Feishu approval failed: ${res.msg}`);
  return { instance_code: res.data.instance_code };
}

module.exports = { getOpenId, submitApproval };
