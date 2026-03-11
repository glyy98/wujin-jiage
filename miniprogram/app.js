// app.js
App({
  onLaunch: function () {
    this.globalData = {
      env: "cloud1-1ghhgzbi9dec0ef5",
      productList: [], // 五金商品列表，由首页写入，详情页读取
    };
    if (!wx.cloud) {
      console.error("请使用 2.2.3 或以上的基础库以使用云能力");
    } else {
      wx.cloud.init({
        env: this.globalData.env,
        traceUser: true,
      });
    }
  },
});
