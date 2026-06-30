import { request } from '../../utils/request';

Page({
  data: { apiKey: '', loading: false, error: '' },
  onInput(e) { this.setData({ apiKey: e.detail.value }); },
  async onSave() {
    const { apiKey } = this.data;
    if (!apiKey.trim()) { this.setData({ error: '请输入 API Key' }); return; }
    this.setData({ loading: true, error: '' });
    try {
      await request({ url: '/api/key', method: 'POST', data: { api_key: apiKey.trim() } });
      tt.showToast({ title: '保存成功', icon: 'success' });
      setTimeout(() => tt.redirectTo({ url: '/pages/index/index' }), 1000);
    } catch (err) {
      this.setData({ error: err.message || '保存失败，请重试' });
    } finally {
      this.setData({ loading: false });
    }
  }
});
