// 供应商管理：查看、新增、删除已保存的供应商（suppliers 集合）
Page({
  data: {
    list: [],
    filteredList: [],
    keyword: "",
    loading: true,
    deletingId: null,
    showAddModal: false,
    addName: "",
  },

  onLoad() {
    this.loadList();
  },

  onShow() {
    this.loadList();
  },

  onSearchInput(e) {
    const keyword = (e.detail.value || "").trim();
    this.setData({ keyword });
    this.applyFilter(keyword);
  },

  onSearch() {
    this.applyFilter(this.data.keyword);
  },

  applyFilter(keyword) {
    const list = this.data.list;
    const lower = (keyword || "").toLowerCase();
    const filteredList = lower
      ? list.filter((item) => (item.name || "").toLowerCase().includes(lower))
      : list;
    this.setData({ filteredList });
  },

  loadList() {
    this.setData({ loading: true });
    wx.cloud
      .callFunction({ name: "quickstartFunctions", data: { type: "getSupplierList" } })
      .then((res) => {
        const result = res.result || {};
        const list = result.list || [];
        this.setData({ list, loading: false });
        this.applyFilter(this.data.keyword);
      })
      .catch(() => {
        this.setData({ list: [], filteredList: [], loading: false });
      });
  },

  onAdd() {
    this.setData({ showAddModal: true, addName: "" });
  },

  onAddNameInput(e) {
    this.setData({ addName: e.detail.value || "" });
  },

  closeAddModal() {
    this.setData({ showAddModal: false, addName: "" });
  },

  submitAdd() {
    const name = (this.data.addName || "").trim();
    if (!name) {
      wx.showToast({ title: "请输入供应商名称", icon: "none" });
      return;
    }
    wx.cloud
      .callFunction({
        name: "quickstartFunctions",
        data: { type: "addSupplierNames", names: [name] },
      })
      .then((res) => {
        const result = res.result || {};
        if (result.success) {
          this.closeAddModal();
          wx.showToast({ title: "已添加", icon: "success" });
          this.loadList();
        } else {
          wx.showToast({ title: result.errMsg || "添加失败", icon: "none" });
        }
      })
      .catch((err) => {
        wx.showToast({ title: err.message || "添加失败", icon: "none" });
      });
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || "该供应商";
    wx.showModal({
      title: "删除供应商",
      content: `确定从列表中删除「${name}」？已保存商品中的该供应商名称不会改变，仅不再出现在筛选列表中。`,
      confirmText: "删除",
      confirmColor: "#e54545",
      success: (res) => {
        if (!res.confirm) return;
        this.doDelete(id);
      },
    });
  },

  doDelete(id) {
    this.setData({ deletingId: id });
    wx.cloud
      .callFunction({
        name: "quickstartFunctions",
        data: { type: "deleteSupplier", id },
      })
      .then((res) => {
        const result = res.result || {};
        this.setData({ deletingId: null });
        if (result.success) {
          wx.showToast({ title: result.message || "已删除", icon: "success" });
          this.loadList();
        } else {
          wx.showToast({ title: result.errMsg || "删除失败", icon: "none" });
        }
      })
      .catch((err) => {
        this.setData({ deletingId: null });
        wx.showToast({ title: err.message || "删除失败", icon: "none" });
      });
  },
});
