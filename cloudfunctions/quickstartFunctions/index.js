const cloud = require("wx-server-sdk");
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const XLSX = require("xlsx");

// 确保 categories 集合存在（首次使用时创建，避免 -502005）
const ensureCategoriesCollection = async () => {
  try {
    await db.createCollection("categories");
  } catch (e) {
    // 集合已存在时部分环境会报错，忽略后后续 get/add 仍可执行
  }
};

// 确保 suppliers 集合存在（首次使用时创建，避免 -502005）
const ensureSuppliersCollection = async () => {
  try {
    await db.createCollection("suppliers");
  } catch (e) {
    // 集合已存在时部分环境会报错，忽略
  }
};

// 获取openid
const getOpenId = async () => {
  // 获取基础信息
  const wxContext = cloud.getWXContext();
  return {
    openid: wxContext.OPENID,
    appid: wxContext.APPID,
    unionid: wxContext.UNIONID,
  };
};

// 获取小程序二维码
const getMiniProgramCode = async () => {
  // 获取小程序二维码的buffer
  const resp = await cloud.openapi.wxacode.get({
    path: "pages/index/index",
  });
  const { buffer } = resp;
  // 将图片上传云存储空间
  const upload = await cloud.uploadFile({
    cloudPath: "code.png",
    fileContent: buffer,
  });
  return upload.fileID;
};

// 创建集合
const createCollection = async () => {
  try {
    // 创建集合
    await db.createCollection("sales");
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华东",
        city: "上海",
        sales: 11,
      },
    });
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华东",
        city: "南京",
        sales: 11,
      },
    });
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华南",
        city: "广州",
        sales: 22,
      },
    });
    await db.collection("sales").add({
      // data 字段表示需新增的 JSON 数据
      data: {
        region: "华南",
        city: "深圳",
        sales: 22,
      },
    });
    return {
      success: true,
    };
  } catch (e) {
    // 这里catch到的是该collection已经存在，从业务逻辑上来说是运行成功的，所以catch返回success给前端，避免工具在前端抛出异常
    return {
      success: true,
      data: "create collection success",
    };
  }
};

// 查询数据
const selectRecord = async () => {
  // 返回数据库查询结果
  return await db.collection("sales").get();
};

// 更新数据
const updateRecord = async (event) => {
  try {
    // 遍历修改数据库信息
    for (let i = 0; i < event.data.length; i++) {
      await db
        .collection("sales")
        .where({
          _id: event.data[i]._id,
        })
        .update({
          data: {
            sales: event.data[i].sales,
          },
        });
    }
    return {
      success: true,
      data: event.data,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 新增数据
const insertRecord = async (event) => {
  try {
    const insertRecord = event.data;
    // 插入数据
    await db.collection("sales").add({
      data: {
        region: insertRecord.region,
        city: insertRecord.city,
        sales: Number(insertRecord.sales),
      },
    });
    return {
      success: true,
      data: event.data,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 删除数据
const deleteRecord = async (event) => {
  try {
    await db
      .collection("sales")
      .where({
        _id: event.data._id,
      })
      .remove();
    return {
      success: true,
    };
  } catch (e) {
    return {
      success: false,
      errMsg: e,
    };
  }
};

// 删除商品（goods 集合，云函数端有权限执行 remove）
const deleteGoods = async (event) => {
  try {
    const id = event.id;
    if (!id) {
      return { success: false, errMsg: "缺少商品 id" };
    }
    await db.collection("goods").doc(id).remove();
    return { success: true };
  } catch (e) {
    console.error("deleteGoods error", e);
    return {
      success: false,
      errMsg: e.message || String(e),
    };
  }
};

// 批量删除商品（仅删文档，不删云存储图片）
const deleteGoodsBatch = async (event) => {
  try {
    const raw = event.ids || event.data?.ids || [];
    const ids = Array.isArray(raw) ? raw.map((id) => (id != null ? String(id).trim() : "")).filter(Boolean) : [];
    if (ids.length === 0) {
      return { success: false, errMsg: "缺少商品 id 列表" };
    }
    const col = db.collection("goods");
    for (const id of ids) {
      try {
        await col.doc(id).remove();
      } catch (e) {
        console.error("deleteGoodsBatch item error", id, e);
      }
    }
    return { success: true, message: "已删除" };
  } catch (e) {
    console.error("deleteGoodsBatch error", e);
    return { success: false, errMsg: e.message || String(e) };
  }
};

// 初始化五金一级大类（左侧树状用），仅在没有数据时写入
const INIT_L1_NAMES = [
  "紧固件",
  "锁具",
  "工具",
  "管件",
  "门窗五金",
  "卫浴五金",
  "拉手/铰链",
  "电气配件",
  "其他",
];

const initCategories = async () => {
  try {
    await ensureCategoriesCollection();
    const col = db.collection("categories");
    const { data } = await col.where({ parentId: "" }).limit(1).get();
    if (data && data.length > 0) {
      return { success: true, message: "分类已存在，无需初始化" };
    }
    for (let i = 0; i < INIT_L1_NAMES.length; i++) {
      await col.add({
        data: {
          name: INIT_L1_NAMES[i],
          parentId: "",
          order: i + 1,
        },
      });
    }
    return { success: true, message: "已初始化一级大类" };
  } catch (e) {
    console.error("initCategories error", e);
    return { success: false, errMsg: e.message || String(e) };
  }
};

// 分类名称唯一性校验（一级、不区分大小写）
const isCategoryNameDuplicate = (list, name, excludeId) => {
  const lower = (name || "").toLowerCase();
  return (list || []).some(
    (c) => (c._id !== excludeId) && ((c.name || "").toLowerCase() === lower)
  );
};

// 新增一级大类（自定义分类），供新增商品时“添加并选用”
const addCategory = async (event) => {
  try {
    const name = (event.name || "").trim();
    if (!name) {
      return { success: false, errMsg: "请输入分类名称" };
    }
    await ensureCategoriesCollection();
    const col = db.collection("categories");
    const { data: list } = await col.where({ parentId: "" }).limit(500).get();
    if (isCategoryNameDuplicate(list, name, null)) {
      return { success: false, errMsg: "分类名称已存在" };
    }
    const existing = (list || []).find((c) => (c.name || "").trim() === name);
    if (existing) {
      return { success: true, id: existing._id, name: existing.name, message: "该分类已存在" };
    }
    // 不用 orderBy，避免未建索引时报错；改为拉取全部一级后取 max(order)
    const listForOrder = list || [];
    let nextOrder = 1;
    if (listForOrder.length > 0) {
      const maxOrder = Math.max(...listForOrder.map((c) => (c.order != null ? c.order : 0)));
      nextOrder = maxOrder + 1;
    }
    const { _id } = await col.add({
      data: { name, parentId: "", order: nextOrder },
    });
    return { success: true, id: _id, name };
  } catch (e) {
    console.error("addCategory error", e);
    return { success: false, errMsg: e.message || String(e) };
  }
};

// 获取一级大类列表（并确保集合存在，避免小程序直接读报 -502005）
const getCategories = async () => {
  try {
    await ensureCategoriesCollection();
    const col = db.collection("categories");
    const { data: list } = await col.where({ parentId: "" }).limit(500).get();
    const sorted = (list || []).slice().sort((a, b) => (a.order || 0) - (b.order || 0));
    return { success: true, list: sorted };
  } catch (e) {
    console.error("getCategories error", e);
    return { success: false, errMsg: e.message || String(e), list: [] };
  }
};

// 编辑一级大类名称，并同步更新其下商品的 categoryName
const updateCategory = async (event) => {
  try {
    const id = String(event.id || "").trim();
    const name = String(event.name || "").trim();
    if (!id) return { success: false, errMsg: "缺少分类 id" };
    if (!name) return { success: false, errMsg: "分类名称不能为空" };
    const col = db.collection("categories");
    const doc = await col.doc(id).get();
    if (!doc.data) return { success: false, errMsg: "分类不存在" };
    if (doc.data.parentId !== "" && doc.data.parentId != null) {
      return { success: false, errMsg: "仅支持编辑一级大类" };
    }
    const { data: list } = await col.where({ parentId: "" }).limit(500).get();
    if (isCategoryNameDuplicate(list, name, id)) {
      return { success: false, errMsg: "分类名称已存在" };
    }
    await col.doc(id).update({ data: { name } });
    const { data: goodsList } = await db.collection("goods").where({ categoryL1Id: id }).field({ _id: true }).limit(500).get();
    const goodsCol = db.collection("goods");
    for (const g of goodsList || []) {
      try {
        await goodsCol.doc(g._id).update({ data: { categoryName: name } });
      } catch (e) {
        console.error("update good categoryName fail", g._id, e);
      }
    }
    return { success: true, message: "已更新" };
  } catch (e) {
    console.error("updateCategory error", e);
    return { success: false, errMsg: e.message || String(e) };
  }
};

// 删除一级大类：将该类下商品改为未分类，再删除分类
const deleteCategory = async (event) => {
  try {
    const id = String(event.id || "").trim();
    if (!id) {
      return { success: false, errMsg: "缺少分类 id" };
    }
    const col = db.collection("categories");
    let catDoc;
    try {
      catDoc = await col.doc(id).get();
    } catch (e) {
      return { success: false, errMsg: "分类不存在或无法读取" };
    }
    if (!catDoc.data) {
      return { success: false, errMsg: "分类不存在" };
    }
    if (catDoc.data.parentId !== "" && catDoc.data.parentId != null) {
      return { success: false, errMsg: "仅支持删除一级大类" };
    }
    // 将该类下商品逐条改为未分类（兼容云数据库 where.update 限制）
    const { data: goodsList } = await db.collection("goods").where({ categoryL1Id: id }).field({ _id: true }).limit(500).get();
    const goodsCol = db.collection("goods");
    for (const g of goodsList || []) {
      try {
        await goodsCol.doc(g._id).update({
          data: { categoryL1Id: "", categoryName: "" },
        });
      } catch (e) {
        console.error("update good fail", g._id, e);
      }
    }
    await col.doc(id).remove();
    return { success: true, message: "已删除，其下商品已归为未分类" };
  } catch (e) {
    console.error("deleteCategory error", e);
    const msg = e.message || e.errMsg || (e.errCode ? `错误码 ${e.errCode}` : String(e));
    return { success: false, errMsg: msg };
  }
};

// 从 goods 与 suppliers 集合合并去重得到供应商名称列表
const getSupplierNames = async () => {
  try {
    const set = new Set();
    const { data: goods } = await db.collection("goods").limit(500).get();
    for (const g of goods || []) {
      if (g.supplierList && Array.isArray(g.supplierList)) {
        for (const sup of g.supplierList) {
          const name = (sup.supplierName || sup.supplier || "").toString().trim();
          if (name) set.add(name);
        }
      }
      const legacy = (g.supplier || "").toString().trim();
      if (legacy) set.add(legacy);
    }
    try {
      await ensureSuppliersCollection();
      const { data: suppList } = await db.collection("suppliers").limit(500).get();
      for (const s of suppList || []) {
        const name = (s.name || "").toString().trim();
        if (name) set.add(name);
      }
    } catch (e) {
      // 忽略
    }
    const list = Array.from(set).sort((a, b) => a.localeCompare(b, "zh"));
    return { success: true, list };
  } catch (e) {
    console.error("getSupplierNames error", e);
    return { success: false, errMsg: e.message || String(e), list: [] };
  }
};

// 将供应商名称写入 suppliers 集合（去重），供筛选框持久化
const addSupplierNames = async (event) => {
  try {
    const names = event.names || [];
    if (!Array.isArray(names) || names.length === 0) return { success: true };
    await ensureSuppliersCollection();
    const col = db.collection("suppliers");
    for (const raw of names) {
      const name = (raw || "").toString().trim();
      if (!name) continue;
      const { data: existing } = await col.where({ name }).limit(1).get();
      if (existing && existing.length > 0) continue;
      await col.add({ data: { name } });
    }
    return { success: true };
  } catch (e) {
    console.error("addSupplierNames error", e);
    return { success: false, errMsg: e.message || String(e) };
  }
};

// 获取 suppliers 集合列表（供供应商管理页）
const getSupplierList = async () => {
  try {
    await ensureSuppliersCollection();
    const { data: raw } = await db.collection("suppliers").limit(500).get();
    const list = (raw || []).slice().sort((a, b) => (a.name || "").localeCompare(b.name || "", "zh"));
    return { success: true, list };
  } catch (e) {
    if (e.errCode === -502005 || (e.message && e.message.includes("collection"))) {
      return { success: true, list: [] };
    }
    console.error("getSupplierList error", e);
    return { success: false, errMsg: e.message || String(e), list: [] };
  }
};

// 删除一条供应商（仅从 suppliers 表移除，不影响已保存商品里的供应商名）
const deleteSupplier = async (event) => {
  try {
    const id = (event.id || "").toString().trim();
    if (!id) return { success: false, errMsg: "缺少 id" };
    await db.collection("suppliers").doc(id).remove();
    return { success: true, message: "已删除" };
  } catch (e) {
    console.error("deleteSupplier error", e);
    return { success: false, errMsg: e.message || String(e) };
  }
};

// 导出商品列表为 Excel，上传云存储后返回 fileID
const exportGoods = async () => {
  try {
    const { data: goods } = await db.collection("goods").limit(500).get();
    const rows = [];
    for (const g of goods || []) {
      const categoryName = g.categoryName || "";
      const name = g.name || "";
      if (g.supplierList && Array.isArray(g.supplierList) && g.supplierList.length > 0) {
        for (const sup of g.supplierList) {
          const supplierName = sup.supplierName || sup.supplier || "";
          const skuList = sup.skuList && Array.isArray(sup.skuList) ? sup.skuList : [];
          if (skuList.length === 0) {
            rows.push({ 商品名称: name, 所属大类: categoryName, 供应商: supplierName, 规格: "", 来货价: "", 售价: "" });
          } else {
            for (const sku of skuList) {
              rows.push({
                商品名称: name,
                所属大类: categoryName,
                供应商: supplierName,
                规格: sku.specName || sku.spec || "",
                来货价: sku.costPrice ?? "",
                售价: sku.salePrice ?? "",
              });
            }
          }
        }
      } else {
        rows.push({
          商品名称: name,
          所属大类: categoryName,
          供应商: g.supplier || "",
          规格: g.spec || "",
          来货价: g.costPrice ?? "",
          售价: g.salePrice ?? "",
        });
      }
    }
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ 商品名称: "", 所属大类: "", 供应商: "", 规格: "", 来货价: "", 售价: "" }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "商品列表");
    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const now = new Date();
    const timeStr = now.getFullYear() + String(now.getMonth() + 1).padStart(2, "0") + String(now.getDate()).padStart(2, "0") + "_" + String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0");
    const cloudPath = `exports/商品列表_${timeStr}.xlsx`;
    const upload = await cloud.uploadFile({
      cloudPath,
      fileContent: buf,
    });
    return { success: true, fileID: upload.fileID };
  } catch (e) {
    console.error("exportGoods error", e);
    return { success: false, errMsg: e.message || String(e) };
  }
};

// const getOpenId = require('./getOpenId/index');
// const getMiniProgramCode = require('./getMiniProgramCode/index');
// const createCollection = require('./createCollection/index');
// const selectRecord = require('./selectRecord/index');
// const updateRecord = require('./updateRecord/index');
// const fetchGoodsList = require('./fetchGoodsList/index');
// const genMpQrcode = require('./genMpQrcode/index');
// 云函数入口函数
exports.main = async (event, context) => {
  switch (event.type) {
    case "getOpenId":
      return await getOpenId();
    case "getMiniProgramCode":
      return await getMiniProgramCode();
    case "createCollection":
      return await createCollection();
    case "selectRecord":
      return await selectRecord();
    case "updateRecord":
      return await updateRecord(event);
    case "insertRecord":
      return await insertRecord(event);
    case "deleteRecord":
      return await deleteRecord(event);
    case "deleteGoods":
      return await deleteGoods(event);
    case "deleteGoodsBatch":
      return await deleteGoodsBatch(event);
    case "initCategories":
      return await initCategories();
    case "addCategory":
      return await addCategory(event);
    case "getCategories":
      return await getCategories();
    case "deleteCategory":
      return await deleteCategory(event);
    case "updateCategory":
      return await updateCategory(event);
    case "exportGoods":
      return await exportGoods();
    case "getSupplierNames":
      return await getSupplierNames();
    case "addSupplierNames":
      return await addSupplierNames(event);
    case "getSupplierList":
      return await getSupplierList();
    case "deleteSupplier":
      return await deleteSupplier(event);
    default:
      return null;
  }
};
