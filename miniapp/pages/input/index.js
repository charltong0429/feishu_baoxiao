import { request } from '../../utils/request';

Page({
  data: { text: '', loading: false, error: '' },
  onInput(e) { this.setData({ text: e.detail.value }); },
  async onSubmit() {
    const { text } = this.data;
    if (!text.trim()) { this.setData({ error: '请输入报销内容描述' }); return; }
    this.setData({ loading: true, error: '' });
    try {
      const extracted = await request({
        url: '/api/extract', method: 'POST', data: { content_type: 'text', content: text.trim() }
      });
      const validation = await request({
        url: '/api/validate', method: 'POST', data: { type: extracted.type, amount: extracted.amount }
      });
      getApp().globalData.extractedData = { ...extracted, warnings: validation.warnings };
      tt.navigateTo({ url: '/pages/preview/index' });
    } catch (err) {
      this.setData({ error: err.message || 'AI 识别失败，请重试' });
    } finally {
      this.setData({ loading: false });
    }
  }
});
