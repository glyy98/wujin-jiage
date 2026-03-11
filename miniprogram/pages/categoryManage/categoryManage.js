// 分类管理：查看一级大类、删除（其下商品会变为未分类）
Page({
  data: {
    list: [],
    loading: true,
    deletingId: null,
  },

  onLoad() {
    this.loadList();
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
        this.setData({
          list: result.list || [],
          loading: false,
        });
      })
      .catch(() => {
        this.setData({ list: [], loading: false });
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
