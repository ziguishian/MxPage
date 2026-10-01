export type FolderFile = { name: string; size: number; type: string; webkitRelativePath: string };
export function groupProductFiles<T extends FolderFile>(files: T[], maxFiles = 8) {
  const groups = new Map<string, { key: string; name: string; files: T[] }>();
  let ignored = 0;
  for (const file of [...files].sort((a, b) => a.webkitRelativePath.localeCompare(b.webkitRelativePath, "zh-CN", { numeric: true }))) {
    if (!/\.(png|jpe?g|webp)$/i.test(file.name)) { ignored++; continue; }
    if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} 超过 10MB，请调整后重新选择文件夹。`);
    const parts = (file.webkitRelativePath || file.name).split("/").filter(Boolean);
    const nested = parts.length > 2;
    // The selected folder is the root. Each first-level child folder is one product,
    // including its deeper view folders. Loose root images remain separate products.
    const key = nested ? `folder:${parts[1]}` : `file:${file.webkitRelativePath || file.name}`;
    const name = nested ? parts[1] : file.name.replace(/\.[^.]+$/, "");
    if (!groups.has(key)) groups.set(key, { key, name, files: [] });
    groups.get(key)!.files.push(file);
  }
  if (groups.size > 50) throw new Error("每批最多 50 个商品，请分批选择。");
  for (const group of groups.values()) if (group.files.length > maxFiles) throw new Error(`「${group.name}」有 ${group.files.length} 张图片，每套最多 ${maxFiles} 张；请整理后重选。`);
  return { groups: [...groups.values()], ignored };
}
