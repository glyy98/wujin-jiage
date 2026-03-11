// addGoods/addGoods.js - 新增五金商品，保存到云数据库 goods
const MAX_IMAGES = 5;
const SIZE_LIMIT = 3 * 1024 * 1024; // 3M

Page({
  data: {
    name: "",
    spec: "",
    supplier: "",
    costPrice: "",
    salePrice: "",
    imageList: [], // 已上传的图片 fileID 列表
    saving: false,
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

  onSave() {
    const { name, spec, supplier, costPrice, salePrice, imageList } = this.data;
    if (!name || !name.trim()) {
      wx.showToast({ title: "请输入商品名称", icon: "none" });
      return;
    }
    this.setData({ saving: true });
    const db = wx.cloud.database();
    db.collection("goods")
      .add({
        data: {
          name: (name || "").trim(),
          spec: (spec || "").trim(),
          supplier: (supplier || "").trim(),
          costPrice: (costPrice || "").trim(),
          salePrice: (salePrice || "").trim(),
          images: imageList || [],
          image: (imageList && imageList[0]) || "", // 首图，列表/详情兼容
          createTime: db.serverDate(),
        },
      })
      .then(() => {
        this.setData({ saving: false });
        wx.showToast({ title: "保存成功", icon: "success" });
        this.setData({
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
  },
});
