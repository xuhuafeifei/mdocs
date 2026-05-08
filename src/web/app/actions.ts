/**
 * 通用文件选择辅助函数
 * 动态创建隐藏的 <input type="file"> 并触发点击，选择完成后回调文件列表并自动移除 DOM 节点。
 */
/**
 * 触发隐藏的文件选择器，支持自定义 accept 类型。
 * 选择后通过回调返回 FileList，并自动清理 DOM。
 */
export function openFileSelector(handleFiles: (files: FileList) => void, accept = "*/*") {
  if (typeof document === "undefined") return;
  const input = document.createElement("input");
  input.type = "file";
  input.accept = accept;
  input.multiple = false;
  input.onchange = (event) => {
    const files = (event.target as HTMLInputElement)?.files;
    if (files && files.length > 0) {
      handleFiles(files);
    }
    input.remove();
  };
  input.click();
}
