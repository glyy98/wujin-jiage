// index.js - 左侧大类树 + 右侧该大类下商品明细
const DB = wx.cloud.database();
const GOODS = DB.collection("goods");

// 一级大类占位：未选或「全部」
const ALL_ID = "";
const MINI_DB_PAGE_SIZE = 20;
const MAX_FETCH_COUNT = 9999;

Page({
  data: {
    keyword: "",
    rawCategoryTree: [],
    categoryList: [{ id: ALL_ID, name: "全部" }],
    selectedCategoryId: ALL_ID,
    subCategoryList: [{ id: ALL_ID, name: "全部" }],
    selectedSubCategoryId: ALL_ID,
    productList: [],
    allProductsInCategory: [],
    loading: true,
  },

  onLoad() {},

  onShow() {
    this.loadCategories();
  },

  // 加载一级+二级分类
  loadCategories() {
    wx.cloud
      .callFunction({ name: "quickstartFunctions", data: { type: "getCategoryTree" } })
      .then((res) => {
        const result = res.result || {};
        const rawTree = result.list || [];
        const list = rawTree.map((c) => ({ id: c._id, name: c.name || "" }));
        const selectedCategoryId = this.ensureValidCategoryId(this.data.selectedCategoryId, list);
        const selectedNode = rawTree.find((n) => n._id === selectedCategoryId);
        const childList = selectedNode && selectedNode.children ? selectedNode.children : [];
        const subCategoryList = [{ id: ALL_ID, name: "全部" }].concat(
          childList.map((c) => ({ id: c._id, name: c.name || "" }))
        );
        const selectedSubCategoryId = this.ensureValidSubCategoryId(
          this.data.selectedSubCategoryId,
          subCategoryList
        );
        this.setData({
          rawCategoryTree: rawTree,
          categoryList: [{ id: ALL_ID, name: "全部" }, ...list],
          selectedCategoryId,
          subCategoryList,
          selectedSubCategoryId,
        });
        this.loadGoods(selectedCategoryId, selectedSubCategoryId);
      })
      .catch((err) => {
        console.warn("加载分类失败，仅显示「全部」", err);
        this.setData({
          rawCategoryTree: [],
          categoryList: [{ id: ALL_ID, name: "全部" }],
          subCategoryList: [{ id: ALL_ID, name: "全部" }],
          selectedCategoryId: ALL_ID,
          selectedSubCategoryId: ALL_ID,
        });
        this.loadGoods(ALL_ID, ALL_ID);
      });
  },

  // 按一级/二级分类加载商品
  loadGoods(categoryL1Id, subCategoryId) {
    this.setData({ loading: true });
    this.fetchGoodsByCategory(categoryL1Id, MAX_FETCH_COUNT)
      .then((res) => {
        const raw = (res || []).map((item) => ({
          ...item,
          id: item._id || item.id,
        }));
        const data = this.filterBySubCategory(raw, subCategoryId);
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

  filterBySubCategory(list, subCategoryId) {
    if (!subCategoryId) return list;
    return (list || []).filter((item) => {
      const l2 = item.categoryL2Id || item.categoryId || item.subCategoryId || "";
      return l2 === subCategoryId;
    });
  },

  // 小程序端单次查询有上限，这里按 20 条循环拉取，最多取 maxCount 条
  fetchGoodsByCategory(categoryL1Id, maxCount) {
    const all = [];
    const fetch = (skip) => {
      let query = GOODS.skip(skip).limit(MINI_DB_PAGE_SIZE);
      if (categoryL1Id) query = query.where({ categoryL1Id });
      return query.get().then((res) => {
        const chunk = res.data || [];
        all.push(...chunk);
        if (chunk.length < MINI_DB_PAGE_SIZE || all.length >= maxCount) {
          return all.slice(0, maxCount);
        }
        return fetch(skip + chunk.length);
      });
    };
    return fetch(0);
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
    const selectedCategoryId = id || ALL_ID;
    const subCategoryList = this.getSubCategoryListByL1(selectedCategoryId);
    const selectedSubCategoryId = ALL_ID;
    this.setData({ selectedCategoryId, subCategoryList, selectedSubCategoryId });
    this.loadGoods(selectedCategoryId, selectedSubCategoryId);
  },

  onSelectSubCategory(e) {
    const id = e.currentTarget.dataset.id || ALL_ID;
    this.setData({ selectedSubCategoryId: id });
    this.loadGoods(this.data.selectedCategoryId, id);
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

  onPreviewImage(e) {
    const url = e.currentTarget.dataset.url;
    if (!url) return;
    wx.previewImage({
      current: url,
      urls: [url],
    });
  },

  goDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({ url: `/pages/product-detail/index?id=${id}` });
  },

  goAddGoods() {
    const categoryL1Id = this.data.selectedCategoryId || "";
    const url = categoryL1Id
      ? `/pages/addGoods/addGoods?categoryL1Id=${encodeURIComponent(categoryL1Id)}`
      : "/pages/addGoods/addGoods";
    wx.navigateTo({ url });
  },

  goGoodsList() {
    wx.navigateTo({ url: "/pages/goodsList/goodsList" });
  },

  goCategoryManage() {
    wx.navigateTo({ url: "/pages/categoryManage/categoryManage" });
  },

  ensureValidCategoryId(id, l1List) {
    if (!id) return ALL_ID;
    const exists = (l1List || []).some((c) => c.id === id);
    return exists ? id : ALL_ID;
  },

  ensureValidSubCategoryId(id, l2List) {
    if (!id) return ALL_ID;
    const exists = (l2List || []).some((c) => c.id === id);
    return exists ? id : ALL_ID;
  },

  getSubCategoryListByL1(l1Id) {
    if (!l1Id) return [{ id: ALL_ID, name: "全部" }];
    const source = this.data.rawCategoryTree || [];
    const node = source.find((n) => n._id === l1Id);
    const children = (node && node.children) || [];
    return [{ id: ALL_ID, name: "全部" }].concat(children.map((c) => ({ id: c._id, name: c.name || "" })));
  },
});
