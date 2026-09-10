/**
 * file_type 政策表。
 *
 * 每种文件类型的能力集中定义，避免硬编码分散在各处。
 * 前后端共用一份表。
 */
import { FILE_TYPE, type FileType } from './file-types.js';

/* ── 政策字段 ── */

export interface FileTypePolicy {
  /** 侧栏树是否作为独立节点展示 */
  treeVisible: boolean;
  /** 构建树时是否包含 */
  treeInclude: boolean;
  /** 是否可移动 */
  movable: boolean;
  /** 是否进入全文搜索 */
  ftsIndex: boolean;
  /** 图谱构建是否当文章抽取 */
  graphExtract: boolean;
  /** 是否作为图谱 walk 的结构节点 */
  graphWalkStruct: boolean;
  /** 创建/规范化允许的后缀 */
  pathExt: string | null;
  /** GET ?format=text 纯文本提取方式 */
  textExtract: 'lexical' | 'raw' | 'none';
  /** 写入前规范化方式 */
  writeNormalize: 'md-lexical' | 'raw' | 'none';
  /** 本地草稿类型 */
  draftKind: 'lexical' | 'html' | 'none';
  /** merge 管道 */
  mergePipeline: 'lexical-md-bridge' | 'raw-text' | 'none';
  /** 编辑器类型 */
  editor: 'lobe' | 'html' | 'none';
}

/* ── 政策表 ── */

const POLICY_TABLE: Record<FileType, FileTypePolicy> = {
  [FILE_TYPE.DOCUMENT]: {
    treeVisible: true,
    treeInclude: true,
    movable: true,
    ftsIndex: true,
    graphExtract: true,
    graphWalkStruct: false,
    pathExt: '.md',
    textExtract: 'lexical',
    writeNormalize: 'md-lexical',
    draftKind: 'lexical',
    mergePipeline: 'lexical-md-bridge',
    editor: 'lobe',
  },
  [FILE_TYPE.HTML]: {
    treeVisible: true,
    treeInclude: true,
    movable: true,
    ftsIndex: false,
    graphExtract: false,
    graphWalkStruct: false,
    pathExt: '.html',
    textExtract: 'raw',
    writeNormalize: 'raw',
    draftKind: 'html',
    mergePipeline: 'raw-text',
    editor: 'html',
  },
  [FILE_TYPE.FOLDER]: {
    treeVisible: true,
    treeInclude: true,
    movable: false,
    ftsIndex: false,
    graphExtract: false,
    graphWalkStruct: true,
    pathExt: null,
    textExtract: 'none',
    writeNormalize: 'none',
    draftKind: 'none',
    mergePipeline: 'none',
    editor: 'none',
  },
  [FILE_TYPE.FOLDER_DESC]: {
    treeVisible: false,
    treeInclude: true,
    movable: false,
    ftsIndex: false,
    graphExtract: false,
    graphWalkStruct: true,
    pathExt: '.md',
    textExtract: 'lexical',
    writeNormalize: 'md-lexical',
    draftKind: 'none',
    mergePipeline: 'none',
    editor: 'none',
  },
  [FILE_TYPE.GRAPH_FILE]: {
    treeVisible: false,
    treeInclude: false,
    movable: false,
    ftsIndex: false,
    graphExtract: false,
    graphWalkStruct: false,
    pathExt: '.json',
    textExtract: 'none',
    writeNormalize: 'none',
    draftKind: 'none',
    mergePipeline: 'none',
    editor: 'none',
  },
  [FILE_TYPE.GRAPH_DIR]: {
    treeVisible: false,
    treeInclude: false,
    movable: false,
    ftsIndex: false,
    graphExtract: false,
    graphWalkStruct: false,
    pathExt: null,
    textExtract: 'none',
    writeNormalize: 'none',
    draftKind: 'none',
    mergePipeline: 'none',
    editor: 'none',
  },
};

/* ── 查询函数 ── */

/** 获取指定文件类型的政策 */
export function getPolicy(fileType: FileType): FileTypePolicy {
  return POLICY_TABLE[fileType];
}

/** 获取 treeInclude === true 的类型列表 */
export function treeIncludeTypes(): FileType[] {
  return (Object.keys(POLICY_TABLE) as FileType[]).filter(
    (t) => POLICY_TABLE[t].treeInclude,
  );
}

/** 获取 graphWalkStruct || graphExtract === true 的类型列表 */
export function graphWalkIncludeTypes(): FileType[] {
  return (Object.keys(POLICY_TABLE) as FileType[]).filter(
    (t) => POLICY_TABLE[t].graphWalkStruct || POLICY_TABLE[t].graphExtract,
  );
}

/** 获取 ftsIndex === true 的类型列表 */
export function ftsIndexTypes(): FileType[] {
  return (Object.keys(POLICY_TABLE) as FileType[]).filter(
    (t) => POLICY_TABLE[t].ftsIndex,
  );
}

/** 获取 movable === true 的类型列表 */
export function movableDocTypes(): FileType[] {
  return (Object.keys(POLICY_TABLE) as FileType[]).filter(
    (t) => POLICY_TABLE[t].movable,
  );
}

/** 判断该文件类型是否可被 overwrite_document 覆写 */
export function canOverwrite(fileType: FileType): boolean {
  return POLICY_TABLE[fileType]?.writeNormalize !== 'none';
}