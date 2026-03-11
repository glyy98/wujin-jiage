// index.js - 五金店商品查询
const MOCK_PRODUCTS = [
  {
    id: "1",
    name: "镀锌六角螺栓 M8×40",
    spec: "M8×40 镀锌",
    supplier: "华南五金批发",
    costPrice: "0.35",
    salePrice: "0.68",
    image: "",
  },
  {
    id: "2",
    name: "膨胀螺丝 M6×40",
    spec: "M6×40 不锈钢",
    supplier: "华东紧固件",
    costPrice: "0.28",
    salePrice: "0.55",
    image: "",
  },
  {
    id: "3",
    name: "十字自攻螺丝 4.2×19",
    spec: "4.2×19 黑磷",
    supplier: "华南五金批发",
    costPrice: "0.02",
    salePrice: "0.05",
    image: "",
  },
  {
    id: "4",
    name: "角码 40×40×2.0",
    spec: "40×40 厚2.0mm",
    supplier: "广东型材厂",
    costPrice: "1.20",
    salePrice: "2.50",
    image: "",
  },
  {
    id: "5",
    name: "合页 不锈钢 3寸",
    spec: "3寸 不锈钢",
    supplier: "浙江五金",
    costPrice: "3.80",
    salePrice: "7.50",
    image: "",
  },
];

Page({
  data: {
    keyword: "",
    productList: [],
    allProducts: [],
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
        const data = (res.data || []).map((item) => ({
          ...item,
          id: item._id || item.id,
        }));
        const app = getApp();
        app.globalData.productList = data;
        this.setData({
          allProducts: data,
          productList: data,
          loading: false,
        });
      })
      .catch((err) => {
        console.error("加载商品失败", err);
        this.setData({ loading: false });
        wx.showToast({
          title: err.message || "加载失败",
          icon: "none",
        });
      });
  },

  onSearchInput(e) {
    this.setData({
      keyword: e.detail.value,
    });
  },

  onSearch() {
    const keyword = (this.data.keyword || "").trim().toLowerCase();
    const list = keyword
      ? this.data.allProducts.filter(
          (p) =>
            (p.name && p.name.toLowerCase().includes(keyword)) ||
            (p.spec && p.spec.toLowerCase().includes(keyword)) ||
            (p.supplier && p.supplier.toLowerCase().includes(keyword))
        )
      : this.data.allProducts;
    this.setData({
      productList: list,
    });
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/product-detail/index?id=${id}`,
    });
  },

  goAddGoods() {
    wx.navigateTo({
      url: "/pages/addGoods/addGoods",
    });
  },

  goGoodsList() {
    wx.navigateTo({
      url: "/pages/goodsList/goodsList",
    });
  },
});
