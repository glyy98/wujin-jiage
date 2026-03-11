// addGoods/addGoods.js - 新增五金商品，保存到云数据库 goods
const MAX_IMAGES = 5;
const SIZE_LIMIT = 3 * 1024 * 1024; // 3M
const db = wx.cloud.database();

Page({
  data: {
    editId: "",
    categoryList: [],
    categoryIndex: 0,
    newCategoryName: "",
    addingCategory: false,
    name: "",
    spec: "",
    supplier: "",
    costPrice: "",
    salePrice: "",
    imageList: [],
    saving: false,
  },

  onLoad(options) {
    const editId = (options.id || "").trim();
    this.setData({ editId });
    if (editId) {
      wx.setNavigationBarTitle({ title: "编辑商品" });
    }
    wx.cloud
      .callFunction({ name: "quickstartFunctions", data: { type: "getCategories" } })
      .then((res) => {
        const result = res.result || {};
        const list = result.list || [];
        this.setData({ categoryList: list });
        if (editId) this.loadProduct(editId, list);
      })
      .catch(() => {
        this.setData({ categoryList: [] });
        if (editId) this.loadProduct(editId, []);
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
        if (p.categoryL1Id && list.length) {
          const i = list.findIndex((c) => c._id === p.categoryL1Id);
          if (i >= 0) categoryIndex = i;
        }
        this.setData({
          name: p.name || "",
          spec: p.spec || "",
          supplier: p.supplier || "",
          costPrice: p.costPrice || "",
          salePrice: p.salePrice || "",
          imageList: p.images || (p.image ? [p.image] : []),
          categoryIndex,
        });
      })
      .catch(() => {});
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value });
  },
  onSpecInput(e) {
    this.setData({ spec: e.detail.value });
  },
  onSupplierInput(e) {
    this.setData({ supplier: e.detail.value });
  },
  onCostPriceInput(e) {
    this.setData({ costPrice: e.detail.value });
  },
  onSalePriceInput(e) {
    this.setData({ salePrice: e.detail.value });
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
      sourceType: ["album"],
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

  onCategoryChange(e) {
    this.setData({ categoryIndex: parseInt(e.detail.value, 10) });
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
        const newCat = { _id: result.id, name: result.name };
        const list = [...this.data.categoryList, newCat];
        this.setData({
          categoryList: list,
          categoryIndex: list.length - 1,
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
    const { editId, name, spec, supplier, costPrice, salePrice, imageList, categoryList, categoryIndex } = this.data;
    if (!name || !name.trim()) {
      wx.showToast({ title: "请输入商品名称", icon: "none" });
      return;
    }
    const cat = categoryList[categoryIndex];
    const categoryL1Id = cat ? cat._id : "";
    const categoryName = cat ? cat.name : "";
    this.setData({ saving: true });
    const payload = {
      categoryL1Id,
      categoryName,
      name: (name || "").trim(),
      spec: (spec || "").trim(),
      supplier: (supplier || "").trim(),
      costPrice: (costPrice || "").trim(),
      salePrice: (salePrice || "").trim(),
      images: imageList || [],
      image: (imageList && imageList[0]) || "",
    };
    if (editId) {
      db.collection("goods")
        .doc(editId)
        .update({ data: payload })
        .then(() => {
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
          this.setData({ saving: false });
          wx.showToast({ title: "保存成功", icon: "success" });
          this.setData({
            categoryIndex: 0,
            name: "",
            spec: "",
            supplier: "",
            costPrice: "",
            salePrice: "",
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
