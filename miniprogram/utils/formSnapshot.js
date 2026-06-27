function cloneSupplierList(supplierList) {
  return (supplierList || []).map((sup) => ({
    supplierName: (sup.supplierName || "").trim(),
    skuList: (sup.skuList || []).map((s) => ({
      specName: (s.specName || "").trim(),
      costPrice: (s.costPrice || "").trim(),
      salePrice: (s.salePrice || "").trim(),
      image: (s.image || "").trim(),
    })),
  }));
}

function takeSnapshot(data) {
  const cat = data.categoryList && data.categoryList[data.categoryIndex];
  const subCat = data.subCategoryList && data.subCategoryList[data.subCategoryIndex];
  return {
    categoryL1Id: (cat && cat._id) || "",
    categoryL2Id: (subCat && subCat._id) || "",
    name: (data.name || "").trim(),
    useSkuImages: !!data.useSkuImages,
    supplierList: cloneSupplierList(data.supplierList),
    imageList: (data.imageList || []).slice(),
  };
}

function cloneSnapshot(snapshot) {
  return JSON.parse(JSON.stringify(snapshot));
}

function isSnapshotEqual(a, b) {
  if (!a || !b) return a === b;
  return JSON.stringify(a) === JSON.stringify(b);
}

module.exports = {
  takeSnapshot,
  cloneSnapshot,
  isSnapshotEqual,
  cloneSupplierList,
};
