Page({
  data: { instanceCode: '' },
  onLoad() {
    this.setData({ instanceCode: getApp().globalData.instanceCode || '' });
    getApp().globalData.extractedData = null;
    getApp().globalData.instanceCode = null;
  },
  goHome() { tt.redirectTo({ url: '/pages/index/index' }); }
});
