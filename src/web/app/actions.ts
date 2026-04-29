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
  };
  input.click();
}
