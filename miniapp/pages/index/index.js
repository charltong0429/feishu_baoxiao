import { request } from '../../utils/request';
import { getToken } from '../../utils/auth';

Page({
  async onShow() {
    await getToken().catch(() => null);
    try {
      const res = await request({ url: '/api/key' });
      if (!res.configured) tt.redirectTo({ url: '/pages/settings/index' });
    } catch {
      tt.redirectTo({ url: '/pages/settings/index' });
    }
  },
  goInput() { tt.navigateTo({ url: '/pages/input/index' }); },
  goOcr()   { tt.navigateTo({ url: '/pages/ocr/index' }); }
});
