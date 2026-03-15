// goodsList/goodsList.js - 从云数据库 goods 集合读取商品列表
Page({
  data: {
    list: [],
    loading: true,
    exporting: false,
    selectMode: false,
    selectedIds: [],
    selectAll: false,
    deleting: false,
  },

  onLoad() {
    this.loadList();
  },

  enterSelectMode() {
    this.setData({ selectMode: true, selectedIds: [], selectAll: false });
  },

  exitSelectMode() {
    this.setData({ selectMode: false, selectedIds: [], selectAll: false });
  },

  onItemTap(e) {
    if (!this.data.selectMode) return;
    const id = e.currentTarget.dataset.id != null ? String(e.currentTarget.dataset.id) : "";
    if (!id) return;
    const selectedIds = this.data.selectedIds.slice();
    const i = selectedIds.indexOf(id);
    if (i >= 0) selectedIds.splice(i, 1);
    else selectedIds.push(id);
    const list = this.data.list || [];
    this.setData({
      selectedIds,
      selectAll: selectedIds.length === list.length && list.length > 0,
    });
  },

  onToggleSelectAll() {
    const list = this.data.list || [];
    const selectAll = !this.data.selectAll;
    const selectedIds = selectAll ? list.map((item) => (item._id != null ? String(item._id) : "")).filter(Boolean) : [];
    this.setData({ selectedIds, selectAll });
  },

  onBatchDelete() {
    const selectedIds = this.data.selectedIds || [];
    if (selectedIds.length === 0) return;
    wx.showModal({
      title: "确认删除",
      content: `确定删除已选 ${selectedIds.length} 件商品？删除后无法恢复。`,
      confirmText: "删除",
      confirmColor: "#e54545",
      success: (res) => {
        if (!res.confirm) return;
        this.doBatchDelete(selectedIds);
      },
    });
  },

  doBatchDelete(ids) {
    if (!ids || ids.length === 0) return;
    const idList = ids.map((id) => (id != null ? String(id) : "")).filter(Boolean);
    if (idList.length === 0) {
      wx.showToast({ title: "未选择有效商品", icon: "none" });
      return;
    }
    this.setData({ deleting: true });
    wx.cloud
      .callFunction({
        name: "quickstartFunctions",
        data: { type: "deleteGoodsBatch", ids: idList },
      })
      .then((res) => {
        const result = res.result || {};
        this.setData({ deleting: false });
        if (result.success) {
          wx.showToast({ title: result.message || "已删除", icon: "success" });
          this.exitSelectMode();
          this.loadList();
        } else {
          wx.showToast({ title: result.errMsg || "删除失败", icon: "none" });
        }
      })
      .catch((err) => {
        this.setData({ deleting: false });
        wx.showToast({ title: err.errMsg || err.message || "删除失败", icon: "none" });
      });
  },

  onExport() {
    if (this.data.exporting) return;
    this.setData({ exporting: true });
    wx.showLoading({ title: "正在生成…" });
    wx.cloud
      .callFunction({ name: "quickstartFunctions", data: { type: "exportGoods" } })
      .then((res) => {
        const result = res.result || {};
        if (!result.success || !result.fileID) {
          wx.hideLoading();
          this.setData({ exporting: false });
          wx.showToast({ title: result.errMsg || "导出失败", icon: "none" });
          return;
        }
        wx.cloud.downloadFile({ fileID: result.fileID }).then((d) => {
          wx.hideLoading();
          this.setData({ exporting: false });
          wx.openDocument({
            filePath: d.tempFilePath,
            fileType: "xlsx",
            showMenu: true,
            success: () => {
              wx.showToast({ title: "已打开文件，可保存或分享", icon: "none", duration: 2000 });
            },
            fail: (err) => {
              wx.showToast({ title: err.errMsg || "打开失败", icon: "none" });
            },
          });
        }).catch((err) => {
          wx.hideLoading();
          this.setData({ exporting: false });
          wx.showToast({ title: err.errMsg || "下载失败", icon: "none" });
        });
      })
      .catch((err) => {
        wx.hideLoading();
        this.setData({ exporting: false });
        wx.showToast({ title: err.errMsg || err.message || "导出失败", icon: "none" });
      });
  },

  loadList() {
    this.setData({ loading: true });
    wx.cloud
      .database()
      .collection("goods")
      .limit(100)
      .get()
      .then((res) => {
        const raw = res.data || [];
        const list = raw.map((item) => ({ ...item, _id: item._id != null ? String(item._id) : item._id }));
        this.setData({
          list,
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
