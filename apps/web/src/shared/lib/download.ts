const BOM = String.fromCharCode(0xfeff);

/** Saves text as a file through the browser. The byte-order mark makes Excel read UTF-8 correctly. */
export function downloadTextFile(filename: string, text: string, mimeType: string): void {
  const url = URL.createObjectURL(new Blob([BOM, text], { type: `${mimeType};charset=utf-8` }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
