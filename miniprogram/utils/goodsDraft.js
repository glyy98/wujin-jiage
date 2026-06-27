// 新增/编辑商品本地草稿
const DRAFT_VERSION = 1;
const DRAFT_EXPIRE_MS = 7 * 24 * 60 * 60 * 1000;
const KEY_ADD = "goods_draft_add";
const KEY_EDIT_PREFIX = "goods_draft_edit_";
const DEFAULT_SUPPLIER = "未知";

function getDraftKey(editId) {
  return editId ? `${KEY_EDIT_PREFIX}${editId}` : KEY_ADD;
}

function isPersistableImageUrl(url) {
  if (!url || typeof url !== "string") return false;
  const u = url.trim();
  if (!u) return false;
  if (u.startsWith("wxfile://") || u.startsWith("http://tmp")) return false;
  return u.startsWith("cloud://") || u.startsWith("https://") || u.startsWith("http://");
}

function filterPersistableImages(imageList) {
  return (imageList || []).filter(isPersistableImageUrl);
}

function collectDraftFromPage(data) {
  const {
    editId,
    categoryList,
    categoryIndex,
    subCategoryList,
    subCategoryIndex,
    name,
    useSkuImages,
    supplierList,
    imageList,
  } = data;
  const cat = categoryList && categoryList[categoryIndex];
  const subCat = subCategoryList && subCategoryList[subCategoryIndex];
  const persistedSupplierList = (supplierList || []).map((sup) => ({
    supplierName: (sup.supplierName || "").trim(),
    skuList: (sup.skuList || []).map((s) => ({
      specName: (s.specName || "").trim(),
      costPrice: (s.costPrice || "").trim(),
      salePrice: (s.salePrice || "").trim(),
      image: isPersistableImageUrl(s.image) ? String(s.image).trim() : "",
    })),
  }));
  return {
    version: DRAFT_VERSION,
    savedAt: Date.now(),
    editId: editId || "",
    categoryL1Id: (cat && cat._id) || "",
    categoryL2Id: (subCat && subCat._id) || "",
    name: (name || "").trim(),
    useSkuImages: !!useSkuImages,
    supplierList: persistedSupplierList,
    imageList: filterPersistableImages(imageList),
  };
}

function hasMeaningfulDraft(draft) {
  if (!draft) return false;
  if ((draft.name || "").trim()) return true;
  if (filterPersistableImages(draft.imageList).length > 0) return true;
  const suppliers = draft.supplierList || [];
  for (let i = 0; i < suppliers.length; i += 1) {
    const sup = suppliers[i];
    const supplierName = (sup.supplierName || "").trim();
    if (supplierName && supplierName !== DEFAULT_SUPPLIER) return true;
    const skus = sup.skuList || [];
    for (let j = 0; j < skus.length; j += 1) {
      const sku = skus[j];
      if ((sku.specName || "").trim()) return true;
      if ((sku.costPrice || "").trim()) return true;
      if ((sku.salePrice || "").trim()) return true;
      if (isPersistableImageUrl(sku.image)) return true;
    }
  }
  return false;
}

function isDraftExpired(draft) {
  if (!draft || !draft.savedAt) return true;
  return Date.now() - draft.savedAt > DRAFT_EXPIRE_MS;
}

function saveDraft(draft) {
  if (!hasMeaningfulDraft(draft)) {
    clearDraft(draft && draft.editId);
    return;
  }
  const key = getDraftKey(draft.editId);
  try {
    wx.setStorageSync(key, draft);
  } catch (e) {
    console.warn("save draft failed", e);
  }
}

function loadDraft(editId) {
  const key = getDraftKey(editId || "");
  try {
    const draft = wx.getStorageSync(key);
    if (!draft || draft.version !== DRAFT_VERSION) return null;
    if (isDraftExpired(draft)) {
      clearDraft(editId);
      return null;
    }
    if (editId) {
      if (draft.editId !== editId) return null;
    } else if (draft.editId) {
      return null;
    }
    return draft;
  } catch (e) {
    return null;
  }
}

function clearDraft(editId) {
  const key = getDraftKey(editId || "");
  try {
    wx.removeStorageSync(key);
  } catch (e) {
    console.warn("clear draft failed", e);
  }
}

module.exports = {
  collectDraftFromPage,
  hasMeaningfulDraft,
  isPersistableImageUrl,
  filterPersistableImages,
  saveDraft,
  loadDraft,
  clearDraft,
};
