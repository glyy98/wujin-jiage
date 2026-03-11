// index.js - 左侧大类树 + 右侧该大类下商品明细
const DB = wx.cloud.database();
const GOODS = DB.collection("goods");

// 一级大类占位：未选或「全部」
const ALL_ID = "";

Page({
  data: {
    keyword: "",
    categoryList: [{ id: ALL_ID, name: "全部" }],
    selectedCategoryId: ALL_ID,
    productList: [],
    allProductsInCategory: [],
    loading: true,
  },

  onLoad() {},

  onShow() {
    this.loadCategories();
    this.loadGoods(this.data.selectedCategoryId);
  },

  // 加载左侧一级大类（树根），走云函数以自动创建 categories 集合
  loadCategories() {
    wx.cloud
      .callFunction({ name: "quickstartFunctions", data: { type: "getCategories" } })
      .then((res) => {
        const result = res.result || {};
        const raw = result.list || [];
        const list = raw.map((c) => ({ id: c._id, name: c.name || "" }));
        this.setData({
          categoryList: [{ id: ALL_ID, name: "全部" }, ...list],
        });
      })
      .catch((err) => {
        console.warn("加载分类失败，仅显示「全部」", err);
        this.setData({ categoryList: [{ id: ALL_ID, name: "全部" }] });
      });
  },

  // 按大类加载商品：空为全部，否则按 categoryL1Id 筛选
  loadGoods(categoryL1Id) {
    this.setData({ loading: true });
    let query = GOODS.limit(200);
    if (categoryL1Id) {
      query = query.where({ categoryL1Id });
    }
    query
      .get()
      .then((res) => {
        const data = (res.data || []).map((item) => ({
          ...item,
          id: item._id || item.id,
        }));
        const app = getApp();
        app.globalData.productList = data;
        this.setData({
          allProductsInCategory: data,
          productList: this.filterByKeyword(data, this.data.keyword),
          loading: false,
        });
      })
      .catch((err) => {
        console.error("加载商品失败", err);
        this.setData({
          allProductsInCategory: [],
          productList: [],
          loading: false,
        });
        wx.showToast({ title: err.message || "加载失败", icon: "none" });
      });
  },

  filterByKeyword(list, keyword) {
    const k = (keyword || "").trim().toLowerCase();
    if (!k) return list;
    return list.filter(
      (p) =>
        (p.name && p.name.toLowerCase().includes(k)) ||
        (p.spec && p.spec.toLowerCase().includes(k)) ||
        (p.supplier && p.supplier.toLowerCase().includes(k))
    );
  },

  onSelectCategory(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ selectedCategoryId: id });
    this.loadGoods(id);
  },

  onSearchInput(e) {
    this.setData({ keyword: e.detail.value });
  },

  onSearch() {
    const { allProductsInCategory, keyword } = this.data;
    this.setData({
      productList: this.filterByKeyword(allProductsInCategory, keyword),
    });
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/product-detail/index?id=${id}` });
  },

  goAddGoods() {
    wx.navigateTo({ url: "/pages/addGoods/addGoods" });
  },

  goGoodsList() {
    wx.navigateTo({ url: "/pages/goodsList/goodsList" });
  },

  goCategoryManage() {
    wx.navigateTo({ url: "/pages/categoryManage/categoryManage" });
  },
});
