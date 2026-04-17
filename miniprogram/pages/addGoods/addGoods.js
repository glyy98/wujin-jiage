// addGoods/addGoods.js - 新增五金商品，保存到云数据库 goods
const MAX_IMAGES = 5;
const SIZE_LIMIT = 3 * 1024 * 1024; // 3M
const db = wx.cloud.database();
const DEFAULT_SUPPLIER = "未知";

Page({
  data: {
    editId: "",
    categoryTree: [],
    categoryList: [],
    categoryIndex: 0,
    subCategoryList: [{ _id: "", name: "全部（可不选）" }],
    subCategoryIndex: 0,
    newCategoryName: "",
    showAddCategoryModal: false,
    addingCategory: false,
    name: "",
    supplierOptions: [DEFAULT_SUPPLIER],
    useSkuImages: false,
    supplierList: [
      { supplierName: DEFAULT_SUPPLIER, supplierOptionIndex: 0, skuList: [{ specName: "", costPrice: "", salePrice: "", image: "" }] },
    ],
    imageList: [],
    saving: false,
  },

  onLoad(options) {
    const editId = (options.id || "").trim();
    const presetCategoryL1Id = (options.categoryL1Id || "").trim();
    this._presetCategoryL1Id = presetCategoryL1Id;
    this.setData({ editId });
    if (editId) {
      wx.setNavigationBarTitle({ title: "编辑商品" });
    }
    wx.cloud
      .callFunction({ name: "quickstartFunctions", data: { type: "getCategoryTree" } })
      .then((res) => {
        const result = res.result || {};
        const tree = result.list || [];
        const list = tree.map((c) => ({ _id: c._id, name: c.name || "" }));
        let categoryIndex = 0;
        if (!editId && presetCategoryL1Id && list.length > 0) {
          const i = list.findIndex((c) => c && c._id === presetCategoryL1Id);
          if (i >= 0) categoryIndex = i;
        }
        const l1Id = list[categoryIndex] ? list[categoryIndex]._id : "";
        const subCategoryList = this.buildSubCategoryList(tree, l1Id);
        this.setData({ categoryTree: tree, categoryList: list, categoryIndex, subCategoryList, subCategoryIndex: 0 });
        if (editId) this.loadProduct(editId, list, tree);
      })
      .catch(() => {
        this.setData({ categoryTree: [], categoryList: [], subCategoryList: [{ _id: "", name: "全部（可不选）" }], subCategoryIndex: 0 });
        if (editId) this.loadProduct(editId, [], []);
      });
    this.refreshSupplierOptions();
  },

  onShow() {
    this.refreshSupplierOptions();
    this.refreshCategoryOptions();
  },

  refreshCategoryOptions() {
    wx.cloud
      .callFunction({ name: "quickstartFunctions", data: { type: "getCategoryTree" } })
      .then((res) => {
        const result = res.result || {};
        const tree = result.list || [];
        const list = tree.map((c) => ({ _id: c._id, name: c.name || "" }));
        const oldList = this.data.categoryList || [];
        const oldIndex = this.data.categoryIndex || 0;
        const currentId = oldList[oldIndex] ? oldList[oldIndex]._id : "";
        const oldSubList = this.data.subCategoryList || [];
        const oldSubIndex = this.data.subCategoryIndex || 0;
        const currentSubId = oldSubList[oldSubIndex] ? oldSubList[oldSubIndex]._id : "";
        let categoryIndex = 0;
        if (currentId && list.length > 0) {
          const i = list.findIndex((c) => c && c._id === currentId);
          if (i >= 0) categoryIndex = i;
        } else if (!this.data.editId && this._presetCategoryL1Id && list.length > 0) {
          const i = list.findIndex((c) => c && c._id === this._presetCategoryL1Id);
          if (i >= 0) categoryIndex = i;
        }
        const l1Id = list[categoryIndex] ? list[categoryIndex]._id : "";
        const subCategoryList = this.buildSubCategoryList(tree, l1Id);
        let subCategoryIndex = 0;
        if (currentSubId) {
          const j = subCategoryList.findIndex((c) => c && c._id === currentSubId);
          if (j >= 0) subCategoryIndex = j;
        }
        this.setData({ categoryTree: tree, categoryList: list, categoryIndex, subCategoryList, subCategoryIndex });
      })
      .catch(() => {});
  },

  buildSubCategoryList(tree, l1Id) {
    if (!l1Id) return [{ _id: "", name: "全部（可不选）" }];
    const parent = (tree || []).find((n) => n && n._id === l1Id);
    const children = (parent && parent.children) || [];
    const list = children.map((c) => ({ _id: c._id, name: c.name || "" }));
    return [{ _id: "", name: "全部（可不选）" }, ...list];
  },

  refreshSupplierOptions() {
    wx.cloud
      .callFunction({ name: "quickstartFunctions", data: { type: "getSupplierList" } })
      .then((res) => {
        const result = res.result || {};
        const list = (result.list || []).map((item) => (item && item.name ? String(item.name).trim() : "")).filter(Boolean);
        const supplierOptions = [DEFAULT_SUPPLIER, ...list.filter((n) => n !== DEFAULT_SUPPLIER)];
        const currentList = this.data.supplierList || [];
        const supplierList = currentList.map((block) => {
          const name = (block.supplierName || "").trim();
          const exists = !!name && supplierOptions.indexOf(name) >= 0;
          const supplierName = exists ? name : DEFAULT_SUPPLIER;
          const supplierOptionIndex = supplierOptions.indexOf(supplierName);
          return { ...block, supplierName, supplierOptionIndex: supplierOptionIndex >= 0 ? supplierOptionIndex : 0 };
        });
        this.setData({ supplierOptions, supplierList });
      })
      .catch(() => {
        const supplierList = (this.data.supplierList || []).map((block) => ({
          ...block,
          supplierName: (block.supplierName || "").trim() || DEFAULT_SUPPLIER,
          supplierOptionIndex: 0,
        }));
        this.setData({ supplierOptions: [DEFAULT_SUPPLIER], supplierList });
      });
  },

  loadProduct(id, categoryList, categoryTree) {
    db.collection("goods")
      .doc(id)
      .get()
      .then((res) => {
        const p = res.data;
        if (!p) return;
        const list = categoryList.length ? categoryList : this.data.categoryList;
        let categoryIndex = 0;
        if (p.categoryL1Id && list.length) {
          const i = list.findIndex((c) => c._id === p.categoryL1Id);
          if (i >= 0) categoryIndex = i;
        }
        let supplierList = [];
        if (p.supplierList && Array.isArray(p.supplierList) && p.supplierList.length > 0) {
          supplierList = p.supplierList.map((sup) => ({
            supplierName: (sup.supplierName ?? sup.supplier ?? "").toString().trim(),
            skuList: (sup.skuList && Array.isArray(sup.skuList) ? sup.skuList : []).map((s) => ({
              specName: (s.specName ?? s.spec ?? "").toString().trim(),
              costPrice: (s.costPrice ?? "").toString().trim(),
              salePrice: (s.salePrice ?? "").toString().trim(),
              image: (s.image || "").toString().trim(),
            })),
          }));
        } else {
          const skuList = p.skuList && Array.isArray(p.skuList) && p.skuList.length > 0
            ? p.skuList.map((s) => ({
                specName: (s.specName ?? s.spec ?? "").toString().trim(),
                costPrice: (s.costPrice ?? "").toString().trim(),
                salePrice: (s.salePrice ?? "").toString().trim(),
                image: (s.image || "").toString().trim(),
              }))
            : [{
                specName: (p.spec || "").toString().trim(),
                costPrice: (p.costPrice ?? "").toString().trim(),
                salePrice: (p.salePrice ?? "").toString().trim(),
                image: "",
              }];
          supplierList = [
            { supplierName: (p.supplier || "").toString().trim(), supplierOptionIndex: 0, skuList },
          ];
        }
        supplierList = supplierList.filter((sup) => sup.skuList.length > 0 || sup.supplierName);
        if (supplierList.length === 0) {
          supplierList = [{ supplierName: "", supplierOptionIndex: 0, skuList: [{ specName: "", costPrice: "", salePrice: "", image: "" }] }];
        } else {
          supplierList = supplierList.map((sup) => ({
            ...sup,
            skuList: sup.skuList.length ? sup.skuList : [{ specName: "", costPrice: "", salePrice: "", image: "" }],
          }));
        }
        const supplierOptions = this.data.supplierOptions || [DEFAULT_SUPPLIER];
        const merged = supplierOptions.slice();
        supplierList.forEach((sup) => {
          const name = (sup.supplierName || "").trim();
          if (name && !merged.includes(name)) merged.push(name);
        });
        const normalized = [DEFAULT_SUPPLIER, ...merged.filter((n) => n && n !== DEFAULT_SUPPLIER)];
        supplierList = supplierList.map((sup) => {
          const name = (sup.supplierName || "").trim() || DEFAULT_SUPPLIER;
          const idx = normalized.indexOf(name);
          return { ...sup, supplierName: name, supplierOptionIndex: idx >= 0 ? idx : 0 };
        });
        const l1Id = p.categoryL1Id || "";
        const subCategoryList = this.buildSubCategoryList(categoryTree || this.data.categoryTree || [], l1Id);
        let subCategoryIndex = 0;
        const l2Id = p.categoryL2Id || p.categoryId || "";
        if (l2Id) {
          const j = subCategoryList.findIndex((c) => c && c._id === l2Id);
          if (j >= 0) subCategoryIndex = j;
        }
        this.setData({
          name: p.name || "",
          supplierOptions: normalized,
          useSkuImages: !!p.useSkuImages,
          supplierList,
          imageList: p.images || (p.image ? [p.image] : []),
          categoryIndex,
          subCategoryList,
          subCategoryIndex,
        });
      })
      .catch(() => {});
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value });
  },
  onSupplierPickerChange(e) {
    const si = parseInt(e.currentTarget.dataset.supplierIndex, 10);
    const idx = parseInt(e.detail.value, 10);
    const supplierOptions = this.data.supplierOptions || [];
    const supplierList = this.data.supplierList.slice();
    if (!supplierList[si]) return;
    const name = supplierOptions[idx] || DEFAULT_SUPPLIER;
    const supplierName = name || DEFAULT_SUPPLIER;
    supplierList[si] = { ...supplierList[si], supplierName, supplierOptionIndex: idx };
    this.setData({ supplierList });
  },
  onSupplierNameInput(e) {
    const si = parseInt(e.currentTarget.dataset.supplierIndex, 10);
    const val = e.detail.value || "";
    const supplierList = this.data.supplierList.slice();
    if (!supplierList[si]) return;
    supplierList[si] = { ...supplierList[si], supplierName: val };
    this.setData({ supplierList });
  },
  onSupplierNameBlur(e) {
    const si = parseInt(e.currentTarget.dataset.supplierIndex, 10);
    const val = (e.detail.value || "").trim();
    const supplierList = this.data.supplierList.slice();
    const supplierOptions = this.data.supplierOptions || [DEFAULT_SUPPLIER];
    if (!supplierList[si]) return;
    if (!val) {
      supplierList[si] = { ...supplierList[si], supplierName: DEFAULT_SUPPLIER, supplierOptionIndex: 0 };
      this.setData({ supplierList });
      return;
    }
    let merged = supplierOptions.slice();
    if (!merged.includes(val)) merged.push(val);
    merged = [DEFAULT_SUPPLIER, ...merged.filter((n) => n && n !== DEFAULT_SUPPLIER)];
    const supplierOptionIndex = merged.indexOf(val);
    supplierList[si] = { ...supplierList[si], supplierName: val, supplierOptionIndex };
    this.setData({ supplierOptions: merged, supplierList });
    // 持久化到 suppliers 集合，下次新增商品时筛选框会有该名称
    wx.cloud.callFunction({
      name: "quickstartFunctions",
      data: { type: "addSupplierNames", names: [val] },
    }).catch(() => {});
  },
  onSkuSpecInput(e) {
    const si = parseInt(e.currentTarget.dataset.supplierIndex, 10);
    const skuIndex = parseInt(e.currentTarget.dataset.skuIndex, 10);
    const val = e.detail.value || "";
    const supplierList = this.data.supplierList.slice();
    if (!supplierList[si] || !supplierList[si].skuList[skuIndex]) return;
    const skuList = supplierList[si].skuList.slice();
    skuList[skuIndex] = { ...skuList[skuIndex], specName: val };
    supplierList[si] = { ...supplierList[si], skuList };
    this.setData({ supplierList });
  },
  onSkuCostInput(e) {
    const si = parseInt(e.currentTarget.dataset.supplierIndex, 10);
    const skuIndex = parseInt(e.currentTarget.dataset.skuIndex, 10);
    const val = e.detail.value || "";
    const supplierList = this.data.supplierList.slice();
    if (!supplierList[si] || !supplierList[si].skuList[skuIndex]) return;
    const skuList = supplierList[si].skuList.slice();
    skuList[skuIndex] = { ...skuList[skuIndex], costPrice: val };
    supplierList[si] = { ...supplierList[si], skuList };
    this.setData({ supplierList });
  },
  onSkuSaleInput(e) {
    const si = parseInt(e.currentTarget.dataset.supplierIndex, 10);
    const skuIndex = parseInt(e.currentTarget.dataset.skuIndex, 10);
    const val = e.detail.value || "";
    const supplierList = this.data.supplierList.slice();
    if (!supplierList[si] || !supplierList[si].skuList[skuIndex]) return;
    const skuList = supplierList[si].skuList.slice();
    skuList[skuIndex] = { ...skuList[skuIndex], salePrice: val };
    supplierList[si] = { ...supplierList[si], skuList };
    this.setData({ supplierList });
  },
  onToggleSkuImageMode(e) {
    this.setData({ useSkuImages: !!e.detail.value });
  },
  onChooseSkuImage(e) {
    const si = parseInt(e.currentTarget.dataset.supplierIndex, 10);
    const skuIndex = parseInt(e.currentTarget.dataset.skuIndex, 10);
    const supplierList = this.data.supplierList.slice();
    if (!supplierList[si] || !supplierList[si].skuList[skuIndex]) return;
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      sizeType: ["compressed"],
      success: (res) => {
        const file = (res.tempFiles || [])[0];
        if (!file) return;
        if (file.size > SIZE_LIMIT) {
          wx.showToast({ title: "图片不能超过3M", icon: "none" });
          return;
        }
        const ext = (file.tempFilePath.split(".").pop() || "jpg").toLowerCase();
        const cloudPath = `goods/sku_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
        wx.showLoading({ title: "上传中..." });
        wx.cloud.uploadFile({
          cloudPath,
          filePath: file.tempFilePath,
          success: (up) => {
            const list = this.data.supplierList.slice();
            const skuList = list[si].skuList.slice();
            skuList[skuIndex] = { ...skuList[skuIndex], image: up.fileID };
            list[si] = { ...list[si], skuList };
            this.setData({ supplierList: list });
          },
          fail: () => {
            wx.showToast({ title: "上传失败", icon: "none" });
          },
          complete: () => wx.hideLoading(),
        });
      },
    });
  },
  onPreviewSkuImage(e) {
    const si = parseInt(e.currentTarget.dataset.supplierIndex, 10);
    const skuIndex = parseInt(e.currentTarget.dataset.skuIndex, 10);
    const supplierList = this.data.supplierList || [];
    const sku = supplierList[si] && supplierList[si].skuList && supplierList[si].skuList[skuIndex];
    const url = sku && sku.image;
    if (!url) return;
    wx.previewImage({ current: url, urls: [url] });
  },
  onRemoveSkuImage(e) {
    const si = parseInt(e.currentTarget.dataset.supplierIndex, 10);
    const skuIndex = parseInt(e.currentTarget.dataset.skuIndex, 10);
    const supplierList = this.data.supplierList.slice();
    if (!supplierList[si] || !supplierList[si].skuList[skuIndex]) return;
    const skuList = supplierList[si].skuList.slice();
    skuList[skuIndex] = { ...skuList[skuIndex], image: "" };
    supplierList[si] = { ...supplierList[si], skuList };
    this.setData({ supplierList });
  },
  onAddSku(e) {
    const si = parseInt(e.currentTarget.dataset.supplierIndex, 10);
    const supplierList = this.data.supplierList.slice();
    if (!supplierList[si]) return;
    const skuList = (supplierList[si].skuList || []).concat([{ specName: "", costPrice: "", salePrice: "", image: "" }]);
    supplierList[si] = { ...supplierList[si], skuList };
    this.setData({ supplierList });
  },
  onAddSupplier() {
    const supplierList = this.data.supplierList.concat([
      { supplierName: DEFAULT_SUPPLIER, supplierOptionIndex: 0, skuList: [{ specName: "", costPrice: "", salePrice: "", image: "" }] },
    ]);
    this.setData({ supplierList });
  },
  onRemoveSku(e) {
    const si = parseInt(e.currentTarget.dataset.supplierIndex, 10);
    const skuIndex = parseInt(e.currentTarget.dataset.skuIndex, 10);
    const supplierList = this.data.supplierList.slice();
    if (!supplierList[si]) return;
    let skuList = supplierList[si].skuList.filter((_, i) => i !== skuIndex);
    if (skuList.length === 0) skuList = [{ specName: "", costPrice: "", salePrice: "", image: "" }];
    supplierList[si] = { ...supplierList[si], skuList };
    this.setData({ supplierList });
  },
  onRemoveSupplier(e) {
    const si = parseInt(e.currentTarget.dataset.supplierIndex, 10);
    let supplierList = this.data.supplierList.filter((_, i) => i !== si);
    if (supplierList.length === 0) {
      supplierList = [{ supplierName: DEFAULT_SUPPLIER, supplierOptionIndex: 0, skuList: [{ specName: "", costPrice: "", salePrice: "", image: "" }] }];
    }
    this.setData({ supplierList });
  },

  onMoveSku(e) {
    const supplierIndex = parseInt(e.currentTarget.dataset.supplierIndex, 10);
    const skuIndex = parseInt(e.currentTarget.dataset.skuIndex, 10);
    const supplierList = this.data.supplierList || [];
    const sup = supplierList[supplierIndex];
    if (!sup || !sup.skuList || sup.skuList.length < 2 || !sup.skuList[skuIndex]) return;
    const total = sup.skuList.length;
    wx.showModal({
      title: "移动规格",
      editable: true,
      placeholderText: `请输入目标位置（1-${total}）`,
      content: String(skuIndex + 1),
      success: (res) => {
        if (!res.confirm) return;
        const val = parseInt((res.content || "").trim(), 10);
        if (Number.isNaN(val) || val < 1 || val > total) {
          wx.showToast({ title: `请输入 1-${total}`, icon: "none" });
          return;
        }
        this.moveSkuToIndex(supplierIndex, skuIndex, val - 1);
      },
    });
  },

  moveSkuToIndex(supplierIndex, fromIndex, toIndex) {
    if (fromIndex === toIndex) return;
    const supplierList = this.data.supplierList.slice();
    const sup = supplierList[supplierIndex];
    if (!sup || !sup.skuList || !sup.skuList[fromIndex]) return;
    const skuList = sup.skuList.slice();
    const moved = skuList.splice(fromIndex, 1)[0];
    skuList.splice(toIndex, 0, moved);
    supplierList[supplierIndex] = { ...sup, skuList };
    this.setData({ supplierList });
  },

  onChooseImage() {
    const left = MAX_IMAGES - this.data.imageList.length;
    if (left <= 0) {
      wx.showToast({ title: "最多上传5张图片", icon: "none" });
      return;
    }
    wx.chooseMedia({
      count: left,
      mediaType: ["image"],
      sourceType: ["album", "camera"],
      sizeType: ["compressed"],
      success: (res) => {
        const files = res.tempFiles || [];
        const over = files.filter((f) => f.size > SIZE_LIMIT);
        if (over.length) {
          wx.showToast({ title: "存在超过3M的图片，已忽略", icon: "none" });
        }
        const valid = files.filter((f) => f.size <= SIZE_LIMIT);
        if (valid.length === 0) return;
        this.uploadImages(valid.map((f) => f.tempFilePath));
      },
      fail: (err) => {
        if (err.errMsg && !err.errMsg.includes("cancel")) {
          wx.showToast({ title: err.errMsg || "选择失败", icon: "none" });
        }
      },
    });
  },

  uploadImages(filePaths) {
    if (!filePaths.length) return;
    wx.showLoading({ title: "上传中..." });
    const list = [...this.data.imageList];
    const total = filePaths.length;
    let done = 0;
    filePaths.forEach((filePath, i) => {
      const ext = filePath.split(".").pop() || "jpg";
      const cloudPath = `goods/${Date.now()}_${i}_${Math.random().toString(36).slice(2)}.${ext}`;
      wx.cloud.uploadFile({
        cloudPath,
        filePath,
        success: (res) => {
          list.push(res.fileID);
          done++;
          if (done === total) {
            wx.hideLoading();
            this.setData({ imageList: list });
          }
        },
        fail: (err) => {
          done++;
          console.error("上传失败", err);
          if (done === total) {
            wx.hideLoading();
            this.setData({ imageList: list });
            wx.showToast({ title: "部分图片上传失败", icon: "none" });
          }
        },
      });
    });
  },

  onRemoveImage(e) {
    const index = e.currentTarget.dataset.index;
    const imageList = this.data.imageList.filter((_, i) => i !== index);
    this.setData({ imageList });
  },

  onPreviewImage(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10);
    const imageList = this.data.imageList || [];
    if (Number.isNaN(index) || index < 0 || index >= imageList.length) return;
    wx.previewImage({
      current: imageList[index],
      urls: imageList,
    });
  },

  onCategoryChange(e) {
    const categoryIndex = parseInt(e.detail.value, 10);
    const list = this.data.categoryList || [];
    const l1Id = list[categoryIndex] ? list[categoryIndex]._id : "";
    const subCategoryList = this.buildSubCategoryList(this.data.categoryTree || [], l1Id);
    this.setData({ categoryIndex, subCategoryList, subCategoryIndex: 0 });
  },

  onSubCategoryChange(e) {
    this.setData({ subCategoryIndex: parseInt(e.detail.value, 10) });
  },

  onNewCategoryInput(e) {
    this.setData({ newCategoryName: e.detail.value });
  },

  openAddCategoryModal() {
    this.setData({ showAddCategoryModal: true, newCategoryName: "" });
  },

  closeAddCategoryModal() {
    if (this.data.addingCategory) return;
    this.setData({ showAddCategoryModal: false, newCategoryName: "" });
  },

  // 自定义新大类：调用云函数添加，并加入列表、自动选用
  onAddCategory() {
    const name = (this.data.newCategoryName || "").trim();
    if (!name) {
      wx.showToast({ title: "请输入新大类名称", icon: "none" });
      return;
    }
    this.setData({ addingCategory: true });
    wx.cloud
      .callFunction({
        name: "quickstartFunctions",
        data: { type: "addCategory", name },
      })
      .then((res) => {
        const result = (res.result || {});
        if (!result.success) {
          wx.showToast({ title: result.errMsg || "添加失败", icon: "none" });
          this.setData({ addingCategory: false });
          return;
        }
        const newCat = { _id: result.id, name: result.name };
        const list = [...this.data.categoryList, newCat];
        const tree = [...(this.data.categoryTree || []), { ...newCat, children: [] }];
        const subCategoryList = this.buildSubCategoryList(tree, result.id);
        this.setData({
          categoryTree: tree,
          categoryList: list,
          categoryIndex: list.length - 1,
          subCategoryList,
          subCategoryIndex: 0,
          newCategoryName: "",
          showAddCategoryModal: false,
          addingCategory: false,
        });
        wx.showToast({ title: result.message || "已添加并选用", icon: "success" });
      })
      .catch((err) => {
        console.error("addCategory fail", err);
        this.setData({ addingCategory: false });
        const msg = (err.errMsg || err.message || "添加失败").replace(/^request:fail\s*/i, "");
        wx.showToast({ title: msg.length > 20 ? "添加失败，请检查网络与云函数" : msg, icon: "none", duration: 2500 });
      });
  },

  onSave() {
    const { editId, name, supplierList, imageList, categoryList, categoryIndex, subCategoryList, subCategoryIndex } = this.data;
    if (!name || !name.trim()) {
      wx.showToast({ title: "请输入商品名称", icon: "none" });
      return;
    }
    const list = (supplierList || [])
      .map((sup) => ({
        supplierName: (sup.supplierName || "").trim(),
        skuList: (sup.skuList || []).map((s) => ({
          specName: (s.specName || "").trim(),
          costPrice: (s.costPrice || "").trim(),
          salePrice: (s.salePrice || "").trim(),
          image: (s.image || "").trim(),
        })),
      }))
      .filter((sup) => {
        const hasName = !!sup.supplierName;
        const hasSku = (sup.skuList || []).some((s) => s.specName || s.costPrice || s.salePrice);
        return hasName && hasSku;
      });
    if (list.length === 0) {
      wx.showToast({ title: "请至少填写一个供应商名称及该供应商下的一行规格", icon: "none" });
      return;
    }
    const cat = categoryList[categoryIndex];
    const categoryL1Id = cat ? cat._id : "";
    const categoryName = cat ? cat.name : "";
    const subCat = subCategoryList[subCategoryIndex];
    const categoryL2Id = subCat ? subCat._id : "";
    const categoryL2Name = subCat ? subCat.name : "";
    const firstSup = list[0];
    const firstSku = (firstSup.skuList && firstSup.skuList[0]) || {};
    this.setData({ saving: true });
    const payload = {
      categoryL1Id,
      categoryName,
      categoryL2Id,
      categoryL2Name,
      categoryId: categoryL2Id,
      name: (name || "").trim(),
      useSkuImages: !!this.data.useSkuImages,
      supplierList: list,
      supplier: firstSup.supplierName,
      spec: firstSku.specName,
      costPrice: firstSku.costPrice,
      salePrice: firstSku.salePrice,
      images: imageList || [],
      image: (imageList && imageList[0]) || "",
    };
    const supplierNamesToSave = list.map((sup) => sup.supplierName).filter(Boolean);
    const afterSave = () => {
      wx.cloud.callFunction({
        name: "quickstartFunctions",
        data: { type: "addSupplierNames", names: supplierNamesToSave },
      }).catch(() => {});
    };
    if (editId) {
      db.collection("goods")
        .doc(editId)
        .update({ data: payload })
        .then(() => {
          afterSave();
          this.setData({ saving: false });
          wx.showToast({ title: "保存成功", icon: "success" });
          setTimeout(() => wx.navigateBack(), 400);
        })
        .catch((err) => {
          this.setData({ saving: false });
          console.error("保存失败", err);
          wx.showToast({ title: err.message || "保存失败", icon: "none" });
        });
    } else {
      db.collection("goods")
        .add({
          data: {
            ...payload,
            createTime: db.serverDate(),
          },
        })
        .then(() => {
          afterSave();
          this.setData({ saving: false });
          wx.showToast({ title: "保存成功", icon: "success" });
          this.setData({
            categoryIndex: 0,
            subCategoryList: this.buildSubCategoryList(this.data.categoryTree || [], (this.data.categoryList[0] && this.data.categoryList[0]._id) || ""),
            subCategoryIndex: 0,
            name: "",
            useSkuImages: false,
            supplierList: [{ supplierName: DEFAULT_SUPPLIER, supplierOptionIndex: 0, skuList: [{ specName: "", costPrice: "", salePrice: "", image: "" }] }],
            imageList: [],
          });
        })
        .catch((err) => {
          this.setData({ saving: false });
          console.error("保存失败", err);
          wx.showToast({
            title: err.message || "保存失败",
            icon: "none",
          });
        });
    }
  },
});
