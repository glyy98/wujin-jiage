// goodsList/goodsList.js - 从云数据库 goods 集合读取商品列表
Page({
  data: {
    list: [],
    loading: true,
  },

  onLoad() {
    this.loadList();
  },

  loadList() {
    this.setData({ loading: true });
    wx.cloud
      .database()
      .collection("goods")
      .limit(100)
      .get()
      .then((res) => {
        this.setData({
          list: res.data || [],
          loading: false,
        });
      })
      .catch((err) => {
        console.error("读取商品列表失败", err);
        this.setData({
          list: [],
          loading: false,
        });
        wx.showToast({
          title: err.message || "加载失败",
          icon: "none",
        });
      });
  },
});
