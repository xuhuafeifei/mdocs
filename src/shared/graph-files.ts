/**
 * 知识图谱相关的特殊文件名与工具函数。
 *
 * 图谱隐藏文件/目录在文档树中不可见，file_type 统一在 shared/file-types.ts 定义。
 * 本文件只放文件名常量和路径判断函数。
 */
import { FILE_TYPE } from './file-types.js';

/** 目录级图谱文件名（每个目录一个） */
export const DIR_GRAPH_FILENAME = '___graph___.json';

/** 文章级图谱缓存目录名（每个目录下一个） */
export const ARTICLE_GRAPH_DIRNAME = '__graph__';

/** 文章级图谱文件后缀 */
export const ARTICLE_GRAPH_FILE_SUFFIX = '.graph.json';

/** 兼容旧引用：graph_file / graph_dir 常量 */
export const GRAPH_FILE_TYPE = {
  FILE: FILE_TYPE.GRAPH_FILE,
  DIR: FILE_TYPE.GRAPH_DIR,
} as const;

export type GraphFileType = 'graph_file' | 'graph_dir';

/** 判断文件名是否是目录级图谱文件 */
export function isDirGraphFile(name: string): boolean {
  return name.toLowerCase() === DIR_GRAPH_FILENAME.toLowerCase();
}

/** 判断目录名是否是文章级图谱缓存目录 */
export function isArticleGraphDir(name: string): boolean {
  return name.toLowerCase() === ARTICLE_GRAPH_DIRNAME.toLowerCase();
}

/** 生成文章级图谱文件的文件名 */
export function articleGraphFileName(documentId: string): string {
  return `${documentId}${ARTICLE_GRAPH_FILE_SUFFIX}`;
}
