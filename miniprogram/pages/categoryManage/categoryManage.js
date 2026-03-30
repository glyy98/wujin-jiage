// 分类管理：一级大类 + 二级子类（树形）
Page({
  data: {
    treeList: [],
    filteredTree: [],
    keyword: "",
    loading: true,
    deletingId: null,
    showEditModal: false,
    editId: "",
    editName: "",
    editIsL2: false,
    showAddModal: false,
    addName: "",
    showAddSubModal: false,
    addSubParentId: "",
    addSubParentName: "",
    addSubName: "",
  },

  onLoad() {
    this.loadList();
  },

  /** 阻止弹窗内容区点击冒泡，避免输入框无法聚焦（点击穿透） */
  noop() {},
  /** 弹窗层阻止触摸穿透到底层页面滚动 */
  preventTouchMove() {},

  onSearchInput(e) {
    const keyword = (e.detail.value || "").trim();
    this.setData({ keyword });
    this.applyFilter(keyword);
  },

  onSearch() {
    this.applyFilter(this.data.keyword);
  },

  applyFilter(keyword) {
    const tree = this.data.treeList || [];
    const lower = (keyword || "").trim().toLowerCase();
    if (!lower) {
      this.setData({ filteredTree: tree });
      return;
    }
    const out = [];
    for (const l1 of tree) {
      const n1 = (l1.name || "").toLowerCase().includes(lower);
      const allSubs = l1.children || [];
      const subsMatch = allSubs.filter((c) => (c.name || "").toLowerCase().includes(lower));
      if (n1) {
        out.push({ ...l1, children: allSubs });
      } else if (subsMatch.length) {
        out.push({ ...l1, children: subsMatch });
      }
    }
    this.setData({ filteredTree: out });
  },

  onShow() {
    this.loadList();
  },

  loadList() {
    this.setData({ loading: true });
    wx.cloud
      .callFunction({ name: "quickstartFunctions", data: { type: "getCategoriesTree" } })
      .then((res) => {
        const result = res.result || {};
        const treeList = result.list || [];
        this.setData({
          treeList,
          loading: false,
        });
        this.applyFilter(this.data.keyword);
      })
      .catch(() => {
        this.setData({ treeList: [], filteredTree: [], loading: false });
      });
  },

  onAddSub(e) {
    const parentId = e.currentTarget.dataset.parentId;
    const parentName = e.currentTarget.dataset.parentName || "";
    this.setData({
      showAddSubModal: true,
      addSubParentId: parentId,
      addSubParentName: parentName,
      addSubName: "",
    });
  },

  onAddSubNameInput(e) {
    this.setData({ addSubName: e.detail.value || "" });
  },

  closeAddSubModal() {
    this.setData({
      showAddSubModal: false,
      addSubParentId: "",
      addSubParentName: "",
      addSubName: "",
    });
  },

  submitAddSub() {
    const { addSubParentId, addSubName } = this.data;
    const name = (addSubName || "").trim();
    if (!name) {
      wx.showToast({ title: "请输入子分类名称", icon: "none" });
      return;
    }
    wx.cloud
      .callFunction({
        name: "quickstartFunctions",
        data: { type: "addSubCategory", parentId: addSubParentId, name },
      })
      .then((res) => {
        const result = res.result || {};
        if (result.success) {
          this.closeAddSubModal();
          wx.showToast({ title: "已添加子分类", icon: "success" });
          this.loadList();
        } else {
          wx.showToast({ title: result.errMsg || "添加失败", icon: "none" });
        }
      })
      .catch((err) => {
        wx.showToast({ title: err.message || "添加失败", icon: "none" });
      });
  },

  onEdit(e) {
    const id = e.currentTarget.dataset.id;
    const name = e.currentTarget.dataset.name || "";
    const isL2 = e.currentTarget.dataset.level === "2";
    this.setData({
      showEditModal: true,
      editId: id,
      editName: name,
      editIsL2: !!isL2,
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
      editIsL2: false,
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
    const { addName: rawName, treeList } = this.data;
    const name = (rawName || "").trim();
    if (!name) {
      wx.showToast({ title: "请输入分类名称", icon: "none" });
      return;
    }
    const nameLower = name.toLowerCase();
    const duplicate = (treeList || []).some((item) => (item.name || "").toLowerCase() === nameLower);
    if (duplicate) {
      wx.showToast({ title: "一级分类名称已存在", icon: "none" });
      return;
    }
    wx.cloud
      .callFunction({
        name: "quickstartFunctions",
        data: { type: "addCategory", name },
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
    const { editId, editName, treeList, editIsL2 } = this.data;
    const name = (editName || "").trim();
    if (!name) {
      wx.showToast({ title: "请输入分类名称", icon: "none" });
      return;
    }
    if (!editIsL2) {
      const nameLower = name.toLowerCase();
      const flatL1 = (treeList || []).map((t) => ({ _id: t._id, name: t.name }));
      const duplicate = flatL1.some((item) => item._id !== editId && (item.name || "").toLowerCase() === nameLower);
      if (duplicate) {
        wx.showToast({ title: "一级分类名称已存在", icon: "none" });
        return;
      }
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
    const isL2 = e.currentTarget.dataset.level === "2";
    wx.showModal({
      title: "删除分类",
      content: isL2
        ? `确定删除子分类「${name}」？仅影响该子类下的商品归类。`
        : `确定删除「${name}」？其下所有子分类将一并删除，商品将变为未分类。`,
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
