/**
 * TET 场景分类树快照（拆分自 mock/mock-egoops.mjs L19-34）
 *
 * 只保留两级样例结构，够 App 端渲染分类选择器。
 */

export const TET = {
  home: {
    name_zh: '居家', name_en: 'home', level: 1, status: 'active',
    children: {
      detached_house: { name_zh: '自建房', name_en: 'detached_house', level: 2, status: 'active' },
      apartment: { name_zh: '公寓', name_en: 'apartment', level: 2, status: 'active' },
    },
  },
  supermarket: {
    name_zh: '商超', name_en: 'supermarket', level: 1, status: 'active',
    children: {
      convenience_store: { name_zh: '便利店', name_en: 'convenience_store', level: 2, status: 'active' },
      warehouse_store: { name_zh: '仓储超市', name_en: 'warehouse_store', level: 2, status: 'active' },
    },
  },
};
