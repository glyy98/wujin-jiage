// 分类管理：查看一级大类、删除（其下商品会变为未分类）
Page({
  data: {
    list: [],
    filteredList: [],
    keyword: "",
    loading: true,
    deletingId: null,
    showEditModal: false,
    editId: "",
    editName: "",
  },

  onLoad() {
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

  onShow() {
    this.loadList();
  },

  loadList() {
    this.setData({ loading: true });
    wx.cloud
      .callFunction({ name: "quickstartFunctions", data: { type: "getCategories" } })
      .then((res) => {
        const result = res.result || {};
        const list = result.list || [];
        this.setData({
          list,
          loading: false,
        });
        this.applyFilter(this.data.keyword);
      })
      .catch(() => {
        this.setData({ list: [], filteredList: [], loading: false });
      });
  },

  onEdit(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || "";
    this.setData({
      showEditModal: true,
      editId: id,
      editName: name,
    });
  },

  onEditNameInput(e) {
    this.setData({ editName: e.detail.value || "" });
  },

  closeEditModal() {
    this.setData({
      showEditModal: false,
      editId: "",
      editName: "",
    });
  },

  submitEdit() {
    const { editId, editName } = this.data;
    const name = (editName || "").trim();
    if (!name) {
      wx.showToast({ title: "请输入分类名称", icon: "none" });
      return;
    }
    wx.cloud
      .callFunction({
        name: "quickstartFunctions",
        data: { type: "updateCategory", id: editId, name },
      })
      .then((res) => {
        const result = res.result || {};
        if (result.success) {
          this.closeEditModal();
          wx.showToast({ title: result.message || "已更新", icon: "success" });
          this.loadList();
        } else {
          wx.showToast({ title: result.errMsg || "更新失败", icon: "none" });
        }
      })
      .catch((err) => {
        wx.showToast({ title: err.message || "更新失败", icon: "none" });
      });
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || "该分类";
    wx.showModal({
      title: "删除分类",
      content: `确定删除「${name}」？其下的商品将变为未分类，仅在「全部」中显示。`,
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
        data: { type: "deleteCategory", id },
      })
      .then((res) => {
        const result = res.result || {};
        this.setData({ deletingId: null });
        if (result.success) {
          wx.showToast({ title: result.message || "已删除", icon: "success" });
          setTimeout(() => {
            wx.navigateBack();
          }, 400);
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
