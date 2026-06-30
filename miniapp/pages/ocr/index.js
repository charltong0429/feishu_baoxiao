import { request } from '../../utils/request';

Page({
  data: { imageUrl: '', loading: false, error: '' },
  chooseImage() {
    tt.chooseImage({
      count: 1, sourceType: ['album', 'camera'],
      success: (res) => this.setData({ imageUrl: res.tempFilePaths[0], error: '' })
    });
  },
  async onSubmit() {
    const { imageUrl } = this.data;
    if (!imageUrl) return;
    this.setData({ loading: true, error: '' });
    try {
      const fs = tt.getFileSystemManager();
      const base64 = fs.readFileSync(imageUrl, 'base64');
      const dataUrl = `data:image/jpeg;base64,${base64}`;
      const extracted = await request({
        url: '/api/extract', method: 'POST', data: { content_type: 'image', content: dataUrl }
      });
      const validation = await request({
        url: '/api/validate', method: 'POST', data: { type: extracted.type, amount: extracted.amount }
      });
      getApp().globalData.extractedData = { ...extracted, warnings: validation.warnings };
      tt.navigateTo({ url: '/pages/preview/index' });
    } catch (err) {
      this.setData({ error: err.message || '识别失败，请重试或改用文字输入' });
    } finally {
      this.setData({ loading: false });
    }
  }
});
