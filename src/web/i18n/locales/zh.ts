import type { TranslationKey } from "../types";

export const zh: Record<TranslationKey, string> = {
  // Common
  loading: "加载中...",
  saved: "已保存",
  saving: "保存中...",
  unsaved: "编辑中...",
  cancel: "取消",
  create: "创建",
  creating: "创建中...",
  close: "关闭",
  delete: "删除",
  save: "保存",
  gotIt: "知道了",
  error: "错误",
  // Brand
  brand: "mdocs",
  // Visitor register
  welcomeTitle: "欢迎使用 mdocs",
  welcomeDesc:
    "输入一个显示名称以创建访客身份。一个安全令牌将存储在此浏览器中，以便在后续访问时识别您。",
  visitorNamePlaceholder: "您的名字",
  createVisitor: "创建访客",
  nameRequired: "请输入名称",
  // Visitor ID notice
  visitorIdNotice: "您的访客 ID 是 {{id}}，请保存以便恢复",
  // Sidebar / tree
  newDocument: "新建文档",
  newFolder: "新建文件夹",
  noDocumentsYet: "暂无文档",
  collapseFolder: "收起文件夹",
  expandFolder: "展开文件夹",
  // Welcome page
  noDocsInDomain: "此域尚无文档。请在下方切换域或创建文档。",
  createDocToStart: "创建一个文档或选择一个文档开始写作。",
  domainLabel: "域",
  defaultDomain: "默认",
  // Editor
  displayNamePlaceholder: "显示名称",
  currentDomainAria: "当前域",
  insertDiagram: "插入图表",
  readOnlyNotice: "> 您无权限编辑\n\n",
  // Create modal
  newDocumentTitle: "新建文档",
  newFolderTitle: "新建文件夹",
  fileNameLabel: "文件名",
  folderNameLabel: "文件夹名",
  fileNameHint:
    "名称按您输入的方式显示；存储路径会被规范化（例如空格 → 下划线）。请使用 .md 文件名。",
  folderNameHint:
    "名称按您输入的方式显示；存储路径会被规范化（例如 folder 1 → folder_1）。",
  untitledPlaceholder: "未命名.md",
  folderExamplePlaceholder: "例如 research",
  pathExists: "此路径已存在，请选择其他名称",
  folderExists: "此名称的文件夹已存在",
  // Confirm
  deleteConfirm: "删除 {{name}}？",
  // Context menu
  newDocIn: "在 {{name}} 中新建文档",
  newDocAtRoot: "在根目录新建文档",
  newDocBeside: "在同级新建文档",
  newFolderIn: "在 {{name}} 中新建文件夹",
  newFolderAtRoot: "在根目录新建文件夹",
  newFolderBeside: "在同级新建文件夹",
  deleteItem: "删除 {{name}}",
  // Flow diagram
  editDiagram: "编辑图表",
  newDiagram: "新建图表",
  saveAndInsert: "保存并插入",
  deleteDiagram: "删除图表",
  // Diagram editor
  openFailed: "打开失败：{{message}}",
  // Palette
  components: "组件",
  dragToCanvas: "拖拽到画布",
  // Palette labels
  shapeRectangle: "矩形",
  shapeRounded: "圆角矩形",
  shapeCircle: "圆形",
  shapeDiamond: "菱形",
  shapeTriangle: "三角形",
  shapePentagon: "五边形",
  shapeText: "文本",
  shapeLine: "线条",
  shapeData: "数据",
  shapeDatabase: "数据库",
  shapeDocument: "文档",
  shapeDisplay: "显示",
  shapeManual: "手动",
  shapeParallel: "并行",
  shapeComment: "注释",
  shapeSubprocess: "子流程",
  shapeQueue: "队列",
  shapeIntStorage: "内部存储",
  shapeExtStorage: "外部存储",
  // Error codes
  errUnauthenticated: "请先注册",
  errBadRequest: "请求无效",
  errInvalidVisitorName: "访客名称无效",
  errDocExists: "文档已存在",
  errDocNotFound: "文档不存在",
  errForbidden: "您没有权限",
  errInternal: "内部错误",
  errInvalidPath: "路径无效",
  errUnknown: "未知错误",
  // Path validation errors
  pathRequired: "需要提供相对路径",
  pathMustBeRelative: "路径必须是相对路径",
  useForwardSlashes: "请使用正斜杠",
  pathNoDotDot: "路径不能包含 ..",
  pathMustEndWithMd: "文档路径必须以 .md 结尾",
  pathUnsupportedChars: "路径包含不支持的字符",
  pathEscapesRoot: "路径超出了文档根目录",
  // Storage validation errors
  enterFolderName: "请输入文件夹名称",
  singleNameNotPath: "请使用单个名称，而非路径",
  invalidFolderName: "文件夹名称无效",
  folderNameTooLong: "文件夹名称过长",
  enterFileName: "请输入文件名",
  singleFileNameNotPath: "请使用文件名，而非路径",
  invalidFileName: "文件名无效",
  fileNameTooLong: "文件名过长",
  // Permission
  permissionLabel: "权限",
  permissionPrivate: "私有",
  permissionInvite: "邀请",
  permissionPublicRead: "公开可读",
  permissionPublicEdit: "公开可编辑",
  // Domain
  personalDomainSuffix: "个人域",
  // Settings
  settings: "设置",
  general: "通用",
  language: "语言",
  backToDocs: "返回文档",
};
