import { request } from '../../utils/request';

Page({
  data: { data: {}, warnings: [], loading: false, error: '' },
  onLoad() {
    const { extractedData } = getApp().globalData;
    if (!extractedData) { tt.navigateBack(); return; }
    const { warnings = [], ...fields } = extractedData;
    this.setData({ data: fields, warnings });
  },
  onChange(e) {
    this.setData({ [`data.${e.currentTarget.dataset.key}`]: e.detail.value });
  },
  async onSubmit() {
    const { data } = this.data;
    this.setData({ loading: true, error: '' });
    try {
      const result = await request({
        url: '/api/submit', method: 'POST',
        data: { ...data, amount: Number(data.amount) }
      });
      getApp().globalData.instanceCode = result.instance_code;
      tt.redirectTo({ url: '/pages/success/index' });
    } catch (err) {
      this.setData({ error: err.message || '提交失败，请重试' });
    } finally {
      this.setData({ loading: false });
    }
  }
});
