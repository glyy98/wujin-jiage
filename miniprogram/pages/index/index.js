// index.js - 左侧大类树 + 右侧该大类下商品明细
const DB = wx.cloud.database();
const GOODS = DB.collection("goods");

// 一级大类占位：未选或「全部」
const ALL_ID = "";

Page({
  data: {
    keyword: "",
    categoryTree: [],
    categoryList: [{ id: ALL_ID, name: "全部" }],
    selectedCategoryId: ALL_ID,
    selectedSubCategoryId: "",
    subNavList: [],
    productList: [],
    allProductsInCategory: [],
    loading: true,
  },

  onLoad() {},

  onShow() {
    wx.cloud
      .callFunction({ name: "quickstartFunctions", data: { type: "getCategoriesTree" } })
      .then((res) => {
        const result = res.result || {};
        const tree = result.list || [];
        const list = tree.map((c) => ({ id: c._id, name: c.name || "" }));
        this.setData({
          categoryTree: tree,
          categoryList: [{ id: ALL_ID, name: "全部" }, ...list],
        });
        this.syncSubNavFromTree();
        this.loadGoods(this.data.selectedCategoryId);
      })
      .catch(() => {
        this.setData({
          categoryTree: [],
          categoryList: [{ id: ALL_ID, name: "全部" }],
          subNavList: [],
        });
        this.loadGoods(this.data.selectedCategoryId);
      });
  },

  /** 分类树刷新后，根据当前选中的一级大类重建二级导航，并校验当前子类是否仍存在 */
  syncSubNavFromTree() {
    const selectedCategoryId = this.data.selectedCategoryId;
    if (!selectedCategoryId) {
      this.setData({ subNavList: [] });
      return;
    }
    const tree = this.data.categoryTree || [];
    const node = tree.find((c) => c._id === selectedCategoryId);
    const children = (node && node.children) || [];
    const subNavList = [{ id: "", name: "全部" }, ...children.map((s) => ({ id: s._id, name: s.name || "" }))];
    let subId = this.data.selectedSubCategoryId || "";
    if (subId && !subNavList.some((s) => s.id === subId)) {
      subId = "";
    }
    this.setData({ subNavList, selectedSubCategoryId: subId });
  },

  // 按大类 / 可选二级 加载商品
  loadGoods(categoryL1Id) {
    this.setData({ loading: true });
    const subId = this.data.selectedSubCategoryId || "";
    let query = GOODS.limit(200);
    if (categoryL1Id) {
      if (subId) {
        query = query.where({ categoryL1Id, categoryL2Id: subId });
      } else {
        query = query.where({ categoryL1Id });
      }
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
    if (!id) {
      this.setData({ selectedCategoryId: id, selectedSubCategoryId: "", subNavList: [] });
    } else {
      const tree = this.data.categoryTree || [];
      const node = tree.find((c) => c._id === id);
      const children = (node && node.children) || [];
      const subNavList = [{ id: "", name: "全部" }, ...children.map((s) => ({ id: s._id, name: s.name || "" }))];
      this.setData({
        selectedCategoryId: id,
        selectedSubCategoryId: "",
        subNavList,
      });
    }
    this.loadGoods(id);
  },

  onSelectSubCategory(e) {
    const id = e.currentTarget.dataset.id;
    this.setData({ selectedSubCategoryId: id });
    this.loadGoods(this.data.selectedCategoryId);
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
