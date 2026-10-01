const expressionSuitability: Record<string, Array<"photo" | "annotation" | "statement" | "information">> = {
  "vivid-lime": ["statement", "information"], "airy-yellow": ["photo", "statement"],
  "cool-sculpture": ["photo", "annotation", "statement"], "cobalt-campaign": ["statement", "information"],
  "dark-editorial": ["photo", "annotation", "statement"], "cocoa-food": ["photo", "information"],
  "sage-glass": ["photo", "annotation"], "aqua-tactile": ["photo", "annotation", "information"],
  "navy-premium": ["photo", "statement", "information"], "olive-editorial": ["photo", "statement"],
  "mineral-set": ["photo", "annotation", "statement"],
};
export const referenceCatalog = ([
  { id: "vivid-lime", title: "亮色品牌主视觉", categories: ["beauty", "everyday"], palette: "荧光绿、暖白、黑", photography: "大比例斜置产品，干净接触阴影", layout: "左侧主张与右侧主体分区", density: "balanced", lesson: "用单一大色块和字号对比建立记忆点", keywords: "高对比 鲜明 亮色 冲击" },
  { id: "airy-yellow", title: "轻盈编辑构图", categories: ["food", "books", "everyday"], palette: "白、柠檬黄、黑", photography: "错位悬浮与远近层次", layout: "编辑式排字与宽弧线组织空间", density: "airy", lesson: "在留白中建立运动和尺度变化", keywords: "轻盈 编辑 清爽" },
  { id: "cool-sculpture", title: "蓝白雕塑摄影", categories: ["beauty", "electronics", "appliances"], palette: "冰蓝、白、深蓝", photography: "侧光体现曲面与立体轮廓", layout: "大产品与椭圆平面，细大字分区", density: "balanced", lesson: "产品与字体拥有独立完整区域", keywords: "蓝色 冷色 几何 清透" },
  { id: "cobalt-campaign", title: "钴蓝强对比", categories: ["food", "electronics", "everyday"], palette: "钴蓝、白、黄", photography: "对角线排列、硬朗高光", layout: "超大标题与斜向物体形成张力", density: "balanced", lesson: "用强对比和裁切制造缩略图冲击", keywords: "强烈 饱和 蓝色 活力" },
  { id: "dark-editorial", title: "黑白立体主视觉", categories: ["electronics", "books", "appliances"], palette: "炭黑、暖白", photography: "窄轮廓光、立体暗部与微距", layout: "暗色摄影区与大字错位", density: "balanced", lesson: "以光线和空间层次完成克制设计", keywords: "黑色 黑白 精密 暗色 立体" },
  { id: "cocoa-food", title: "奶油可可食欲", categories: ["food"], palette: "奶油、可可棕", photography: "温暖食物近景和触感", layout: "宽波浪、柔和大字与摄影交错", density: "balanced", lesson: "食欲摄影与章节色面连续衔接", keywords: "温暖 食欲 奶油 可可" },
  { id: "sage-glass", title: "鼠尾草通透层次", categories: ["beauty", "home", "everyday"], palette: "鼠尾草绿、暖白", photography: "玻璃透光、柔和植物光影", layout: "大摄影与轻文字层级", density: "airy", lesson: "通透材质与投影营造深度", keywords: "绿色 自然 植物 玻璃" },
  { id: "aqua-tactile", title: "水蓝触感摄影", categories: ["beauty", "appliances", "everyday"], palette: "浅水蓝、白", photography: "近景产品与柔软光影", layout: "大产品与短标题，少量信息分组", density: "balanced", lesson: "摄影、使用动作和信息分区交替", keywords: "水感 清洁 清透 蓝色" },
  { id: "navy-premium", title: "深蓝空间层次", categories: ["beauty", "electronics", "appliances"], palette: "深蓝、银白", photography: "建筑式玻璃布景与方向性反光", layout: "深浅章节和精细字体层级", density: "balanced", lesson: "材质反射和空间关系形成质感", keywords: "深蓝 精致 高级 科技" },
  { id: "olive-editorial", title: "白绿编辑排版", categories: ["beauty", "home", "books"], palette: "暖白、橄榄绿", photography: "侧边通透曲面与柔和静物", layout: "衬线大字、非对称图文关系", density: "airy", lesson: "用大字比例和曲面引导建立节奏", keywords: "编辑 衬线 自然 雅致" },
  { id: "mineral-set", title: "暖色矿物布景", categories: ["beauty", "home", "books", "apparel"], palette: "砂岩、米白、陶土", photography: "石材层次、方向性柔光与真实投影", layout: "主体与两侧文字形成稳定重心", density: "balanced", lesson: "靠布景、明暗和比例制造高级感，不依赖装饰堆叠", keywords: "暖色 矿物 材质 高级 书册" },
] as const).map(reference => ({ ...reference, expressions: expressionSuitability[reference.id] }));

export type StyleReference = {
  id: string; source: "builtin" | "upload"; title: string; reason: string; url: string;
  expressions?: Array<"photo" | "annotation" | "statement" | "information">;
};
export const builtinReferenceUrl = (id: string) => `/ecommerce-references/${id}.jpg`;
