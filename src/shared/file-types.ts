/**
 * 统一的 file_type 定义。
 *
 * mdocs 文档系统中，不同类型的文件/目录通过 file_type 区分：
 * - md / dir：普通文档和目录（文档树中可见）
 * - folder_desc：目录描述文件（___desc___.md，文档树中不可见，用于目录展示）
 * - graph_file / graph_dir：图谱相关文件（文档树中不可见）
 *
 * 新增文件类型在这里统一定义，不要散落在各处。
 */

export const FILE_TYPE = {
  /** 普通 Markdown 文章（文档树中可见） */
  DOCUMENT: 'md',
  /** 普通目录（文档树中可见） */
  FOLDER: 'dir',
  /** 目录描述文件 ___desc___.md（文档树中不可见，用于展示目录介绍） */
  FOLDER_DESC: 'folder_desc',
  /** 图谱 JSON 文件（文档树中不可见） */
  GRAPH_FILE: 'graph_file',
  /** 图谱缓存目录 __graph__（文档树中不可见） */
  GRAPH_DIR: 'graph_dir',
} as const;

export type FileType = typeof FILE_TYPE[keyof typeof FILE_TYPE];

/** 判断是否是文档树中可见的类型（普通 md 文件 + 目录） */
export function isVisibleFileType(fileType: string): boolean {
  return fileType === FILE_TYPE.DOCUMENT || fileType === FILE_TYPE.FOLDER;
}

/** 判断是否是目录类型（普通目录或特殊目录） */
export function isFolderFileType(fileType: string): boolean {
  return fileType === FILE_TYPE.FOLDER || fileType === FILE_TYPE.GRAPH_DIR;
}

/** 判断是否是图谱相关的文件类型 */
export function isGraphFileType(fileType: string): boolean {
  return fileType === FILE_TYPE.GRAPH_FILE || fileType === FILE_TYPE.GRAPH_DIR;
}
