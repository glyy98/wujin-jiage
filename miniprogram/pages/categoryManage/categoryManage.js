// 分类管理：查看一级大类、删除（其下商品会变为未分类）
Page({
  data: {
    treeList: [],
    filteredTree: [],
    keyword: "",
    loading: true,
    deletingId: null,
    movingId: null,
    showEditModal: false,
    editId: "",
    editName: "",
    showAddModal: false,
    addName: "",
    addParentId: "",
    addParentName: "",
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
    const list = this.data.treeList || [];
    const lower = (keyword || "").toLowerCase();
    if (!lower) {
      this.setData({ filteredTree: list });
      return;
    }
    const filteredTree = list
      .map((parent) => {
        const parentMatched = (parent.name || "").toLowerCase().includes(lower);
        const children = (parent.children || []).filter((child) =>
          (child.name || "").toLowerCase().includes(lower)
        );
        if (!parentMatched && children.length === 0) return null;
        return { ...parent, children: parentMatched ? parent.children || [] : children };
      })
      .filter(Boolean);
    this.setData({ filteredTree });
  },

  onShow() {
    this.loadList();
  },

  loadList() {
    this.setData({ loading: true });
    wx.cloud
      .callFunction({ name: "quickstartFunctions", data: { type: "getCategoryTree" } })
      .then((res) => {
        const result = res.result || {};
        const list = result.list || [];
        this.setData({
          treeList: list,
          loading: false,
        });
        this.applyFilter(this.data.keyword);
      })
      .catch(() => {
        this.setData({ treeList: [], filteredTree: [], loading: false });
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

  onAdd() {
    this.setData({ showAddModal: true, addName: "", addParentId: "", addParentName: "" });
  },

  onAddChild(e) {
    const parentId = e.currentTarget.dataset.parentId || "";
    const parentName = e.currentTarget.dataset.parentName || "";
    this.setData({ showAddModal: true, addName: "", addParentId: parentId, addParentName: parentName });
  },

  onAddNameInput(e) {
    this.setData({ addName: e.detail.value || "" });
  },

  closeAddModal() {
    this.setData({ showAddModal: false, addName: "", addParentId: "", addParentName: "" });
  },

  submitAdd() {
    const { addName: rawName, treeList, addParentId } = this.data;
    const name = (rawName || "").trim();
    if (!name) {
      wx.showToast({ title: "请输入分类名称", icon: "none" });
      return;
    }
    const nameLower = name.toLowerCase();
    let siblings = [];
    if (addParentId) {
      const parent = (treeList || []).find((p) => p._id === addParentId);
      siblings = (parent && parent.children) || [];
    } else {
      siblings = treeList || [];
    }
    const duplicate = siblings.some((item) => (item.name || "").toLowerCase() === nameLower);
    if (duplicate) {
      wx.showToast({ title: "分类名称已存在", icon: "none" });
      return;
    }
    wx.cloud
      .callFunction({
        name: "quickstartFunctions",
        data: { type: "addCategory", name, parentId: addParentId || "" },
      })
      .then((res) => {
        const result = res.result || {};
        if (result.success && result.id) {
          this.closeAddModal();
          wx.showToast({ title: "已添加", icon: "success" });
          this.loadList();
        } else if (result.success && result.message === "该分类已存在") {
          wx.showToast({ title: "分类名称已存在", icon: "none" });
        } else {
          wx.showToast({ title: result.errMsg || "添加失败", icon: "none" });
        }
      })
      .catch((err) => {
        wx.showToast({ title: err.message || "添加失败", icon: "none" });
      });
  },

  submitEdit() {
    const { editId, editName, treeList } = this.data;
    const name = (editName || "").trim();
    if (!name) {
      wx.showToast({ title: "请输入分类名称", icon: "none" });
      return;
    }
    const nameLower = name.toLowerCase();
    const flat = [];
    (treeList || []).forEach((p) => {
      flat.push(p);
      (p.children || []).forEach((c) => flat.push(c));
    });
    const duplicate = flat.some(
      (item) => item._id !== editId && (item.name || "").toLowerCase() === nameLower
    );
    if (duplicate) {
      wx.showToast({ title: "分类名称已存在", icon: "none" });
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

  onMove(e) {
    const id = e.currentTarget.dataset.id;
    const order = Number(e.currentTarget.dataset.order || 0);
    const total = Number(e.currentTarget.dataset.total || 0);
    if (!id || !total) return;
    wx.showModal({
      title: "移动分类",
      editable: true,
      placeholderText: `请输入目标位置（1-${total}）`,
      content: String(order),
      success: (res) => {
        if (!res.confirm) return;
        const val = parseInt((res.content || "").trim(), 10);
        if (Number.isNaN(val) || val < 1 || val > total) {
          wx.showToast({ title: `请输入 1-${total}`, icon: "none" });
          return;
        }
        this.setData({ movingId: id });
        wx.cloud
          .callFunction({
            name: "quickstartFunctions",
            data: { type: "moveCategory", id, toIndex: val - 1 },
          })
          .then((r) => {
            const result = r.result || {};
            this.setData({ movingId: null });
            if (result.success) {
              this.loadList();
            } else {
              wx.showToast({ title: result.errMsg || "调整失败", icon: "none" });
            }
          })
          .catch((err) => {
            this.setData({ movingId: null });
            wx.showToast({ title: err.message || "调整失败", icon: "none" });
          });
      },
    });
  },
});
