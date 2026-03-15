// product-detail/index.js - 商品详情
const db = wx.cloud.database();

Page({
  data: {
    product: null,
    productId: "",
    deleting: false,
    selectedSupplierIndex: 0,
    selectedSkuIndex: 0,
    currentSkuList: [],
  },

  onLoad(options) {
    const id = options.id || "";
    this.setData({ productId: id });
    const app = getApp();
    const list = app.globalData.productList || [];
    const product = list.find((p) => p.id === id || p._id === id) || null;
    const selectedSupplierIndex = 0;
    let selectedSkuIndex = 0;
    let currentSkuList = [];
    if (product && product.supplierList && product.supplierList.length > 0) {
      currentSkuList = product.supplierList[0].skuList || [];
      selectedSkuIndex = currentSkuList.length > 0 ? 0 : -1;
    } else if (product && product.skuList && product.skuList.length > 0) {
      selectedSkuIndex = 0;
    }
    this.setData({ product, selectedSupplierIndex, selectedSkuIndex, currentSkuList });
    if (product) {
      wx.setNavigationBarTitle({
        title: product.name || "商品详情",
      });
    }
  },

  onShow() {
    const id = this.data.productId;
    if (id) this.loadProduct(id);
  },

  loadProduct(id) {
    db.collection("goods")
      .doc(id)
      .get()
      .then((res) => {
        const data = res.data;
        if (!data) {
          this.setData({ product: null });
          return;
        }
        const product = { ...data, id: data._id };
        let selectedSupplierIndex = 0;
        let selectedSkuIndex = 0;
        let currentSkuList = [];
        if (product.supplierList && product.supplierList.length > 0) {
          currentSkuList = product.supplierList[0].skuList || [];
          selectedSkuIndex = currentSkuList.length > 0 ? 0 : -1;
        } else if (product.skuList && product.skuList.length > 0) {
          selectedSkuIndex = 0;
        }
        this.setData({ product, selectedSupplierIndex, selectedSkuIndex, currentSkuList });
        wx.setNavigationBarTitle({ title: product.name || "商品详情" });
      })
      .catch(() => {
        this.setData({ product: null });
      });
  },

  onSelectSupplier(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10);
    if (Number.isNaN(index) || index < 0) return;
    const product = this.data.product;
    const currentSkuList = (product.supplierList && product.supplierList[index]) ? (product.supplierList[index].skuList || []) : [];
    this.setData({
      selectedSupplierIndex: index,
      selectedSkuIndex: 0,
      currentSkuList,
    });
  },

  onSelectSku(e) {
    const index = parseInt(e.currentTarget.dataset.index, 10);
    if (Number.isNaN(index) || index < 0) return;
    this.setData({ selectedSkuIndex: index });
  },

  onEdit() {
    const id = this.data.product && (this.data.product._id || this.data.product.id);
    if (!id) return;
    wx.navigateTo({
      url: "/pages/addGoods/addGoods?id=" + id,
    });
  },

  onDelete() {
    const { product, deleting } = this.data;
    if (!product || deleting) return;
    const docId = product._id || product.id;
    if (!docId) {
      wx.showToast({ title: "无法获取商品ID", icon: "none" });
      return;
    }
    wx.showModal({
      title: "确认删除该商品？",
      content: "删除后无法恢复，商品将从列表中移除。",
      confirmText: "删除",
      confirmColor: "#e54d42",
      success: (res) => {
        if (!res.confirm) return;
        this.setData({ deleting: true });
        const doRemove = () => {
          wx.cloud
            .callFunction({
              name: "quickstartFunctions",
              data: { type: "deleteGoods", id: docId },
            })
            .then((res) => {
              const result = res.result;
              if (result && result.success) {
                this.setData({ deleting: false });
                wx.showToast({ title: "删除成功", icon: "success" });
                const pages = getCurrentPages();
                if (pages.length > 1) {
                  const prev = pages[pages.length - 2];
                  if (typeof prev.loadList === "function") {
                    prev.loadList();
                  }
                }
                setTimeout(() => {
                  wx.navigateBack();
                }, 400);
              } else {
                this.setData({ deleting: false });
                wx.showToast({
                  title: (result && result.errMsg) || "删除失败",
                  icon: "none",
                });
              }
            })
            .catch((err) => {
              console.error("删除失败", err);
              this.setData({ deleting: false });
              wx.showToast({
                title: err.errMsg || "删除失败",
                icon: "none",
              });
            });
        };

        const images = product.images || [];
        if (images.length) {
          wx.cloud.deleteFile({
            fileList: images,
            complete: () => {
              // 无论图片删不删成功，都继续删记录
              doRemove();
            },
          });
        } else if (product.image) {
          wx.cloud.deleteFile({
            fileList: [product.image],
            complete: () => {
              doRemove();
            },
          });
        } else {
          doRemove();
        }
      },
    });
  },
});
