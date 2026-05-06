/**
 * 全局 TypeScript 类型声明扩展
 * 为 window 对象添加 playground 调试所需的属性（editor 实例、scrollIntoView 工具）。
 */
declare global {
  interface Window {
    _pensRegistered?: boolean;
    /** Lobe Editor playground debug hook (same as upstream demo). */
    editor?: import("@lobehub/editor").IEditor;
    __scrollIntoView?: typeof import("@lobehub/editor").scrollIntoView;
  }
}

export {};
