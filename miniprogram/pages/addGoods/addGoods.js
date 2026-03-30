// addGoods/addGoods.js - 新增五金商品，保存到云数据库 goods
const MAX_IMAGES = 5;
const SIZE_LIMIT = 3 * 1024 * 1024; // 3M
const db = wx.cloud.database();

Page({
  data: {
    editId: "",
    categoryTree: [],
    categoryList: [],
    categoryIndex: 0,
    subCategoryList: [],
    subCategoryIndex: 0,
    subCategoryPickerRange: [{ name: "无二级（仅大类）" }],
    newCategoryName: "",
    addingCategory: false,
    newSubCategoryName: "",
    addingSubCategory: false,
    name: "",
    supplierOptions: ["请选择供应商"],
    supplierList: [
      { supplierName: "", supplierOptionIndex: 0, skuList: [{ specName: "", costPrice: "", salePrice: "" }] },
    ],
    imageList: [],
    saving: false,
    /** 所属大类 / 二级分类 / 供应商：底部弹层代替原生 picker */
    showCategoryModal: false,
    showSubCategoryModal: false,
    showSupplierModal: false,
    /** 当前正在选供应商的 supplierList 下标 */
    supplierModalBlockIndex: 0,
  },

  onLoad(options) {
    const editId = (options.id || "").trim();
    this.setData({ editId });
    if (editId) {
      wx.setNavigationBarTitle({ title: "编辑商品" });
    }
    wx.cloud
      .callFunction({ name: "quickstartFunctions", data: { type: "getCategoriesTree" } })
      .then((res) => {
        const result = res.result || {};
        const tree = result.list || [];
        const list = tree.map((n) => ({ _id: n._id, name: n.name, children: n.children || [] }));
        const subList = list.length ? list[0].children || [] : [];
        this.setData({
          categoryTree: tree,
          categoryList: list,
          subCategoryList: subList,
          subCategoryIndex: 0,
          subCategoryPickerRange: [{ name: "无二级（仅大类）" }, ...subList],
        });
        if (editId) this.loadProduct(editId, list);
      })
      .catch(() => {
        this.setData({
          categoryTree: [],
          categoryList: [],
          subCategoryList: [],
          subCategoryIndex: 0,
          subCategoryPickerRange: [{ name: "无二级（仅大类）" }],
        });
        if (editId) this.loadProduct(editId, []);
      });
    this.refreshSupplierOptions();
  },

  onShow() {
    this.refreshSupplierOptions();
  },

  onHide() {
    this.setData({ showCategoryModal: false, showSubCategoryModal: false, showSupplierModal: false });
  },

  refreshSupplierOptions() {
    wx.cloud
      .callFunction({ name: "quickstartFunctions", data: { type: "getSupplierNames" } })
      .then((res) => {
        const result = res.result || {};
        const list = result.list || [];
        let supplierOptions = list.length ? ["请选择供应商", ...list] : ["请选择供应商"];
        const currentList = this.data.supplierList || [];
        currentList.forEach((block) => {
          const name = (block.supplierName || "").trim();
          if (name && supplierOptions.indexOf(name) < 0) supplierOptions.push(name);
        });
        const supplierList = currentList.map((block) => {
          const name = (block.supplierName || "").trim();
          const supplierOptionIndex = name ? Math.max(0, supplierOptions.indexOf(name)) : 0;
          return { ...block, supplierOptionIndex };
        });
        this.setData({ supplierOptions, supplierList });
      })
      .catch(() => {
        this.setData({ supplierOptions: ["请选择供应商"] });
      });
  },

  loadProduct(id, categoryList) {
    db.collection("goods")
      .doc(id)
      .get()
      .then((res) => {
        const p = res.data;
        if (!p) return;
        const list = categoryList.length ? categoryList : this.data.categoryList;
        let categoryIndex = 0;
        let subCategoryIndex = 0;
        let subCategoryList = [];
        if (p.categoryL1Id && list.length) {
          const i = list.findIndex((c) => c._id === p.categoryL1Id);
          if (i >= 0) {
            categoryIndex = i;
            subCategoryList = list[i].children || [];
            if (p.categoryL2Id && subCategoryList.length) {
              const j = subCategoryList.findIndex((c) => c._id === p.categoryL2Id);
              if (j >= 0) subCategoryIndex = j + 1;
            }
          }
        }
        let supplierList = [];
        if (p.supplierList && Array.isArray(p.supplierList) && p.supplierList.length > 0) {
          supplierList = p.supplierList.map((sup) => ({
            supplierName: (sup.supplierName ?? sup.supplier ?? "").toString().trim(),
            skuList: (sup.skuList && Array.isArray(sup.skuList) ? sup.skuList : []).map((s) => ({
              specName: (s.specName ?? s.spec ?? "").toString().trim(),
              costPrice: (s.costPrice ?? "").toString().trim(),
              salePrice: (s.salePrice ?? "").toString().trim(),
            })),
          }));
        } else {
          const skuList = p.skuList && Array.isArray(p.skuList) && p.skuList.length > 0
            ? p.skuList.map((s) => ({
                specName: (s.specName ?? s.spec ?? "").toString().trim(),
                costPrice: (s.costPrice ?? "").toString().trim(),
                salePrice: (s.salePrice ?? "").toString().trim(),
              }))
            : [{
                specName: (p.spec || "").toString().trim(),
                costPrice: (p.costPrice ?? "").toString().trim(),
                salePrice: (p.salePrice ?? "").toString().trim(),
              }];
          supplierList = [
            { supplierName: (p.supplier || "").toString().trim(), supplierOptionIndex: 0, skuList },
          ];
        }
        supplierList = supplierList.filter((sup) => sup.skuList.length > 0 || sup.supplierName);
        if (supplierList.length === 0) {
          supplierList = [{ supplierName: "", supplierOptionIndex: 0, skuList: [{ specName: "", costPrice: "", salePrice: "" }] }];
        } else {
          supplierList = supplierList.map((sup) => ({
            ...sup,
            skuList: sup.skuList.length ? sup.skuList : [{ specName: "", costPrice: "", salePrice: "" }],
          }));
        }
        const supplierOptions = this.data.supplierOptions || ["请选择供应商"];
        const merged = supplierOptions.slice();
        supplierList.forEach((sup) => {
          const name = (sup.supplierName || "").trim();
          if (name && !merged.includes(name)) merged.push(name);
        });
        supplierList = supplierList.map((sup) => {
          const name = (sup.supplierName || "").trim();
          const idx = merged.indexOf(name);
          return { ...sup, supplierOptionIndex: idx >= 0 ? idx : 0 };
        });
        const subPicker = [{ name: "无二级（仅大类）" }, ...subCategoryList];
        const maxIdx = Math.max(0, subPicker.length - 1);
        const safeSubIdx = Math.min(Math.max(0, subCategoryIndex), maxIdx);
        this.setData({
          name: p.name || "",
          supplierOptions: merged,
          supplierList,
          imageList: p.images || (p.image ? [p.image] : []),
          categoryIndex,
          subCategoryList,
          subCategoryIndex: safeSubIdx,
          subCategoryPickerRange: subPicker,
        });
      })
      .catch(() => {});
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value });
  },
  /** 供应商：底部弹层 */
  onOpenSupplierModal(e) {
    const si = parseInt(e.currentTarget.dataset.supplierIndex, 10);
    if (Number.isNaN(si)) return;
    const supplierOptions = this.data.supplierOptions || [];
    if (!supplierOptions.length) {
      wx.showToast({ title: "暂无供应商选项", icon: "none" });
      return;
    }
    this.setData({
      showSupplierModal: true,
      supplierModalBlockIndex: si,
      showCategoryModal: false,
      showSubCategoryModal: false,
    });
  },

  closeSupplierModal() {
    this.setData({ showSupplierModal: false });
  },

  onSelectSupplierFromModal(e) {
    const idx = parseInt(e.currentTarget.dataset.index, 10);
    if (Number.isNaN(idx)) return;
    const blockIndex = this.data.supplierModalBlockIndex;
    this.applySupplierOption(blockIndex, idx);
    this.closeSupplierModal();
  },

  applySupplierOption(supplierBlockIndex, optionIndex) {
    const supplierOptions = this.data.supplierOptions || [];
    const max = Math.max(0, supplierOptions.length - 1);
    const idx = Math.min(Math.max(0, optionIndex), max);
    const supplierList = this.data.supplierList.slice();
    if (!supplierList[supplierBlockIndex]) return;
    const name = supplierOptions[idx];
    const supplierName = (name === "请选择供应商" ? "" : name) || "";
    supplierList[supplierBlockIndex] = {
      ...supplierList[supplierBlockIndex],
      supplierName,
      supplierOptionIndex: idx,
    };
    this.setData({ supplierList });
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
  onAddSku(e) {
    const si = parseInt(e.currentTarget.dataset.supplierIndex, 10);
    const supplierList = this.data.supplierList.slice();
    if (!supplierList[si]) return;
    const skuList = (supplierList[si].skuList || []).concat([{ specName: "", costPrice: "", salePrice: "" }]);
    supplierList[si] = { ...supplierList[si], skuList };
    this.setData({ supplierList });
  },
  onAddSupplier() {
    const supplierList = this.data.supplierList.concat([
      { supplierName: "", supplierOptionIndex: 0, skuList: [{ specName: "", costPrice: "", salePrice: "" }] },
    ]);
    this.setData({ supplierList });
  },
  onRemoveSku(e) {
    const si = parseInt(e.currentTarget.dataset.supplierIndex, 10);
    const skuIndex = parseInt(e.currentTarget.dataset.skuIndex, 10);
    const supplierList = this.data.supplierList.slice();
    if (!supplierList[si]) return;
    let skuList = supplierList[si].skuList.filter((_, i) => i !== skuIndex);
    if (skuList.length === 0) skuList = [{ specName: "", costPrice: "", salePrice: "" }];
    supplierList[si] = { ...supplierList[si], skuList };
    this.setData({ supplierList });
  },
  onRemoveSupplier(e) {
    const si = parseInt(e.currentTarget.dataset.supplierIndex, 10);
    let supplierList = this.data.supplierList.filter((_, i) => i !== si);
    if (supplierList.length === 0) {
      supplierList = [{ supplierName: "", supplierOptionIndex: 0, skuList: [{ specName: "", costPrice: "", salePrice: "" }] }];
    }
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
      // 同时支持「从相册选择」和「拍照」
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

  preventTouchMove() {},

  /** 点击「所属大类」打开弹层 */
  onOpenCategoryModal() {
    const list = this.data.categoryList || [];
    if (!list.length) {
      wx.showToast({ title: "暂无大类，请先在下方添加或去管理分类", icon: "none" });
      return;
    }
    this.setData({ showCategoryModal: true, showSubCategoryModal: false, showSupplierModal: false });
  },

  closeCategoryModal() {
    this.setData({ showCategoryModal: false });
  },

  /** 二级分类 */
  onOpenSubCategoryModal() {
    const { categoryList, categoryIndex } = this.data;
    if (!categoryList.length || !categoryList[categoryIndex]) {
      wx.showToast({ title: "请先选择所属大类", icon: "none" });
      return;
    }
    const range = this.data.subCategoryPickerRange || [];
    if (!range.length) {
      wx.showToast({ title: "暂无二级选项", icon: "none" });
      return;
    }
    this.setData({ showSubCategoryModal: true, showCategoryModal: false, showSupplierModal: false });
  },

  closeSubCategoryModal() {
    this.setData({ showSubCategoryModal: false });
  },

  onSelectSubCategoryFromModal(e) {
    const idx = parseInt(e.currentTarget.dataset.index, 10);
    if (Number.isNaN(idx)) return;
    this.applySubCategoryIndex(idx);
    this.closeSubCategoryModal();
  },

  applySubCategoryIndex(idx) {
    const range = this.data.subCategoryPickerRange || [];
    const max = Math.max(0, range.length - 1);
    const clamped = Math.min(Math.max(0, idx), max);
    this.setData({ subCategoryIndex: clamped });
  },

  onSelectCategoryFromModal(e) {
    const idx = parseInt(e.currentTarget.dataset.index, 10);
    if (Number.isNaN(idx)) return;
    this.applyCategoryIndex(idx);
    this.closeCategoryModal();
  },

  /** 切换一级分类并刷新二级列表 */
  applyCategoryIndex(categoryIndex) {
    const list = this.data.categoryList || [];
    if (!list.length) return;
    const idx = Math.min(Math.max(0, categoryIndex), list.length - 1);
    const node = list[idx];
    const subCategoryList = node && node.children ? node.children : [];
    this.setData({
      categoryIndex: idx,
      subCategoryList,
      subCategoryIndex: 0,
      subCategoryPickerRange: [{ name: "无二级（仅大类）" }, ...subCategoryList],
    });
  },

  onNewSubCategoryInput(e) {
    this.setData({ newSubCategoryName: e.detail.value || "" });
  },

  /** 在当前一级下新增二级并选用（与「管理分类」里添加子类一致） */
  onAddSubCategory() {
    const { categoryList, categoryIndex, newSubCategoryName } = this.data;
    const parent = categoryList[categoryIndex];
    if (!parent || !parent._id) {
      wx.showToast({ title: "请先选择一级分类", icon: "none" });
      return;
    }
    const name = (newSubCategoryName || "").trim();
    if (!name) {
      wx.showToast({ title: "请输入二级分类名称", icon: "none" });
      return;
    }
    this.setData({ addingSubCategory: true });
    wx.cloud
      .callFunction({
        name: "quickstartFunctions",
        data: { type: "addSubCategory", parentId: parent._id, name },
      })
      .then((res) => {
        const result = res.result || {};
        this.setData({ addingSubCategory: false });
        if (!result.success) {
          wx.showToast({ title: result.errMsg || "添加失败", icon: "none" });
          return;
        }
        const newSub = { _id: result.id, name: result.name };
        const list = this.data.categoryList.slice();
        const cur = list[categoryIndex];
        const children = [...(cur.children || []), newSub];
        list[categoryIndex] = { ...cur, children };
        const subCategoryList = children;
        const subCategoryPickerRange = [{ name: "无二级（仅大类）" }, ...subCategoryList];
        const subCategoryIndex = subCategoryPickerRange.length - 1;
        this.setData({
          categoryList: list,
          subCategoryList,
          subCategoryIndex,
          subCategoryPickerRange,
          newSubCategoryName: "",
        });
        wx.showToast({ title: "已添加并选用", icon: "success" });
      })
      .catch((err) => {
        this.setData({ addingSubCategory: false });
        wx.showToast({ title: err.message || "添加失败", icon: "none" });
      });
  },

  onNewCategoryInput(e) {
    this.setData({ newCategoryName: e.detail.value });
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
        const newCat = { _id: result.id, name: result.name, children: [] };
        const list = [...this.data.categoryList, newCat];
        this.setData({
          categoryList: list,
          categoryIndex: list.length - 1,
          subCategoryList: [],
          subCategoryIndex: 0,
          subCategoryPickerRange: [{ name: "无二级（仅大类）" }],
          newCategoryName: "",
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
    const {
      editId,
      name,
      supplierList,
      imageList,
      categoryList,
      categoryIndex,
      subCategoryList,
      subCategoryIndex,
    } = this.data;
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
    const subIdx = subCategoryIndex > 0 ? subCategoryIndex - 1 : -1;
    const sub = subIdx >= 0 && subCategoryList[subIdx] ? subCategoryList[subIdx] : null;
    const categoryL2Id = sub ? sub._id : "";
    const categoryL2Name = sub ? sub.name : "";
    const firstSup = list[0];
    const firstSku = (firstSup.skuList && firstSup.skuList[0]) || {};
    this.setData({ saving: true });
    const payload = {
      categoryL1Id,
      categoryName,
      categoryL2Id,
      categoryL2Name,
      name: (name || "").trim(),
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
            name: "",
            supplierList: [{ supplierName: "", supplierOptionIndex: 0, skuList: [{ specName: "", costPrice: "", salePrice: "" }] }],
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
