import { ref, computed, nextTick, type Ref, type InjectionKey } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { LazyStore } from "@tauri-apps/plugin-store";
import type {
  FileEntry,
  TreeRoot,
  TreeRootKind,
  ContextMenuState,
  RenamingState,
  Tab,
} from "../types";

const MAX_RECENT_FOLDERS = 5;
const store = new LazyStore("settings.json");

function isInvalidName(name: string): boolean {
  return /[\\/:*?"<>|]/.test(name);
}
function toPosix(p: string): string {
  return p.replace(/\\/g, "/");
}
function joinPath(parent: string, name: string): string {
  return toPosix(parent) + "/" + name;
}
function parentOf(p: string): string {
  const n = toPosix(p);
  return n.substring(0, n.lastIndexOf("/"));
}
function basename(p: string): string {
  const n = toPosix(p);
  return n.substring(n.lastIndexOf("/") + 1);
}

export function useWorkspace(deps: {
  tabs: Ref<Tab[]>;
  openFile: (path: string) => void | Promise<void>;
  closeTab: (id: string) => void;
}) {
  const roots = ref<TreeRoot[]>([]);
  const libraryRoot = computed<TreeRoot | null>(
    () => roots.value.find((r) => r.kind === "library") ?? null,
  );
  const externalRoots = computed<TreeRoot[]>(() =>
    roots.value.filter((r) => r.kind === "external"),
  );

  const contextMenu = ref<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    target: null,
    parentPath: null,
    rootKind: null,
  });

  const renaming = ref<RenamingState>({
    active: false,
    path: "",
    originalName: "",
    input: "",
  });

  const dragging = ref<{ entry: FileEntry; rootKind: TreeRootKind } | null>(null);
  const dragOverPath = ref<string | null>(null);

  function rootOfPath(path: string): TreeRoot | null {
    const np = toPosix(path);
    let best: TreeRoot | null = null;
    for (const r of roots.value) {
      const rp = toPosix(r.path);
      if (np === rp || np.startsWith(rp + "/")) {
        if (!best || rp.length > toPosix(best.path).length) best = r;
      }
    }
    return best;
  }

  function stampParents(entries: FileEntry[], parentPath: string) {
    for (const e of entries) {
      e.parent = parentPath;
      if (e.children) stampParents(e.children, e.path);
    }
  }

  async function loadRoot(root: TreeRoot) {
    try {
      const entries = await invoke<FileEntry[]>("read_directory", { path: root.path });
      root.entries = entries;
      root.invalid = false;
      stampParents(root.entries, root.path);
    } catch (e) {
      console.error("读取目录失败:", e);
      root.invalid = true;
      root.entries = [];
    }
  }

  async function reloadRoot(root: TreeRoot) {
    await loadRoot(root);
  }

  async function reloadPath(path: string) {
    const r = rootOfPath(path);
    if (r) await loadRoot(r);
  }

  // ---- 增量更新:局部增删改节点,避免整根重载 ----
  function sortEntries(entries: FileEntry[]) {
    entries.sort((a, b) => {
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
  }

  function findEntry(root: TreeRoot, path: string): FileEntry | null {
    const np = toPosix(path);
    const walk = (entries: FileEntry[] | undefined): FileEntry | null => {
      if (!entries) return null;
      for (const e of entries) {
        if (toPosix(e.path) === np) return e;
        const r = walk(e.children);
        if (r) return r;
      }
      return null;
    };
    return walk(root.entries);
  }

  // 返回 parentPath 的直接子数组(根 entries 或某文件夹 children)。找不到返回 null。
  function getChildrenOf(root: TreeRoot, parentPath: string): FileEntry[] | null {
    if (toPosix(parentPath) === toPosix(root.path)) return root.entries;
    const parent = findEntry(root, parentPath);
    if (parent && parent.is_dir) {
      if (!parent.children) parent.children = [];
      return parent.children;
    }
    return null;
  }

  // 在 parentPath 下插入 entry(排序 + 展开父)。失败返回 false。
  function insertEntry(root: TreeRoot, parentPath: string, entry: FileEntry): boolean {
    const children = getChildrenOf(root, parentPath);
    if (!children) return false;
    children.push(entry);
    sortEntries(children);
    if (toPosix(parentPath) !== toPosix(root.path)) {
      const parent = findEntry(root, parentPath);
      if (parent) parent.is_open = true;
    }
    return true;
  }

  // 从树中剪下 path 节点(含子树)。返回被剪节点或 null。
  function removeEntry(root: TreeRoot, path: string): FileEntry | null {
    const np = toPosix(path);
    const walk = (entries: FileEntry[]): FileEntry | null => {
      const idx = entries.findIndex((e) => toPosix(e.path) === np);
      if (idx >= 0) return entries.splice(idx, 1)[0];
      for (const e of entries) {
        if (e.children) {
          const r = walk(e.children);
          if (r) return r;
        }
      }
      return null;
    };
    return walk(root.entries);
  }

  // 把 node 子树所有 path 的 oldPrefix 前缀替换为 newPrefix(posix)
  function updateSubtreePaths(node: FileEntry, oldPrefix: string, newPrefix: string) {
    const np = toPosix(node.path);
    if (np.startsWith(oldPrefix)) {
      node.path = newPrefix + np.substring(oldPrefix.length);
    }
    if (node.children) for (const c of node.children) updateSubtreePaths(c, oldPrefix, newPrefix);
  }

  async function ensureLibrary() {
    try {
      const path = await invoke<string>("ensure_library");
      if (!libraryRoot.value) {
        roots.value.unshift({ kind: "library", path, label: "我的库", entries: [], is_open: true });
      } else {
        libraryRoot.value.path = path;
      }
      if (libraryRoot.value) await loadRoot(libraryRoot.value);
    } catch (e) {
      console.error("初始化库失败:", e);
    }
  }

  async function reloadLibrary() {
    if (libraryRoot.value) await loadRoot(libraryRoot.value);
  }

  async function migrateLibrary() {
    const dst = await open({ directory: true, multiple: false, defaultPath: libraryRoot.value?.path });
    if (!dst) return;
    if (!window.confirm("迁移库将把所有文档移动到新目录，确认继续？")) return;
    const oldPath = libraryRoot.value?.path ?? "";
    try {
      const newPath = await invoke<string>("migrate_library", { newPath: dst });
      remapTabsUnderDir(oldPath, newPath);
      if (libraryRoot.value) {
        libraryRoot.value.path = newPath;
        await loadRoot(libraryRoot.value);
      }
    } catch (e) {
      alert("迁移失败: " + e);
    }
  }

  async function addExternalRoot(path: string): Promise<boolean> {
    const exists = roots.value.some((r) => toPosix(r.path) === toPosix(path));
    if (exists) return false;
    const root: TreeRoot = {
      kind: "external",
      path,
      label: basename(path),
      entries: [],
      is_open: true,
    };
    roots.value.push(root);
    await loadRoot(root);
    await persistRecentFolders();
    return true;
  }

  async function openExternalFolder(): Promise<string | null> {
    try {
      const selected = await open({ directory: true, multiple: false });
      if (!selected) return null;
      const path = selected as string;
      await addExternalRoot(path);
      return path;
    } catch (e) {
      console.error("打开文件夹失败:", e);
      return null;
    }
  }

  async function closeExternalRoot(path: string) {
    roots.value = roots.value.filter((r) => r.path !== path);
  }

  async function removeRecentFolder(path: string) {
    await closeExternalRoot(path);
    try {
      const recent = await getRecentFolders();
      const next = recent.filter((p) => toPosix(p) !== toPosix(path));
      await store.set("recentFolders", next);
      await store.save();
    } catch {}
  }

  async function getRecentFolders(): Promise<string[]> {
    try {
      const v = await store.get<string[]>("recentFolders");
      return Array.isArray(v) ? v : [];
    } catch {
      return [];
    }
  }

  async function persistRecentFolders() {
    try {
      const paths = externalRoots.value.map((r) => r.path).slice(0, MAX_RECENT_FOLDERS);
      await store.set("recentFolders", paths);
      await store.save();
    } catch {}
  }

  async function restoreExternalRoots() {
    const recent = await getRecentFolders();
    for (const p of recent) {
      const root: TreeRoot = {
        kind: "external",
        path: p,
        label: basename(p),
        entries: [],
        is_open: true,
      };
      roots.value.push(root);
      await loadRoot(root);
    }
  }

  async function init() {
    await ensureLibrary();
    await restoreExternalRoots();
  }

  function remapTabPath(oldPath: string, newPath: string) {
    for (const t of deps.tabs.value) {
      if (t.path === oldPath) {
        t.path = newPath;
        t.name = basename(newPath);
      }
    }
  }

  function remapTabsUnderDir(oldDir: string, newDir: string) {
    const o = toPosix(oldDir);
    const n = toPosix(newDir);
    for (const t of deps.tabs.value) {
      if (!t.path) continue;
      const tp = toPosix(t.path);
      if (tp === o) {
        t.path = n;
        t.name = basename(n);
      } else if (tp.startsWith(o + "/")) {
        t.path = n + tp.substring(o.length);
      }
    }
  }

  function closeTabsUnderPath(path: string) {
    const np = toPosix(path);
    for (const t of [...deps.tabs.value]) {
      if (!t.path) continue;
      const tp = toPosix(t.path);
      if (tp === np || tp.startsWith(np + "/")) {
        deps.closeTab(t.id);
      }
    }
  }

  function showContextMenu(
    event: MouseEvent,
    entry: FileEntry | null,
    root: TreeRoot,
  ) {
    event.preventDefault();
    event.stopPropagation();
    // 右键目录:新建落到该目录内部;右键文件:落到其所在目录;右键空白:落到当前根
    const parentPath = entry
      ? entry.is_dir
        ? entry.path
        : entry.parent ?? root.path
      : root.path;
    const menuWidth = 170;
    const menuHeight = 220;
    let x = event.clientX;
    let y = event.clientY;
    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10;
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10;
    contextMenu.value = {
      visible: true,
      x: Math.max(10, x),
      y: Math.max(10, y),
      target: entry,
      parentPath,
      rootKind: root.kind,
    };
  }

  function showContextMenuOnTree(event: MouseEvent, root: TreeRoot) {
    event.preventDefault();
    event.stopPropagation();
    showContextMenu(event, null, root);
  }

  function hideContextMenu() {
    contextMenu.value.visible = false;
    contextMenu.value.target = null;
    contextMenu.value.parentPath = null;
    contextMenu.value.rootKind = null;
  }

  const menuInLibrary = computed(() => contextMenu.value.rootKind === "library");
  const menuTargetIsFolder = computed(() => !!contextMenu.value.target?.is_dir);
  const menuCanNewFile = computed(() => true);
  const menuCanNewFolder = computed(() => menuInLibrary.value);
  const menuCanRename = computed(() => !menuTargetIsFolder.value || menuInLibrary.value);
  const menuCanDelete = computed(() => !menuTargetIsFolder.value || menuInLibrary.value);
  const menuCanMove = computed(() => !menuTargetIsFolder.value || menuInLibrary.value);

  async function handleNewFile() {
    const parentPath = contextMenu.value.parentPath;
    if (!parentPath) return;
    const name = window.prompt("请输入文件名:", "新建文件.md");
    if (!name) return;
    if (isInvalidName(name)) {
      alert("文件名包含非法字符，请使用有效的文件名");
      return;
    }
    const filePath = joinPath(parentPath, name);
    try {
      await invoke("create_file", { path: filePath });
      const r = rootOfPath(parentPath);
      if (r) {
        const ok = insertEntry(r, parentPath, {
          name,
          path: filePath,
          is_dir: false,
          is_open: false,
          parent: parentPath,
        });
        if (!ok) await loadRoot(r);
      }
    } catch (e) {
      alert("创建文件失败: " + e);
    }
    hideContextMenu();
  }

  async function handleNewFolder() {
    if (!menuCanNewFolder.value) return;
    const parentPath = contextMenu.value.parentPath;
    if (!parentPath) return;
    const name = window.prompt("请输入文件夹名:", "新建文件夹");
    if (!name) return;
    if (isInvalidName(name)) {
      alert("文件夹名包含非法字符，请使用有效的文件名");
      return;
    }
    const folderPath = joinPath(parentPath, name);
    try {
      await invoke("create_directory", { path: folderPath });
      const r = rootOfPath(parentPath);
      if (r) {
        const ok = insertEntry(r, parentPath, {
          name,
          path: folderPath,
          is_dir: true,
          is_open: false,
          children: [],
          parent: parentPath,
        });
        if (!ok) await loadRoot(r);
      }
    } catch (e) {
      alert("创建文件夹失败: " + e);
    }
    hideContextMenu();
  }

  function handleRename() {
    if (!contextMenu.value.target) return;
    if (contextMenu.value.target.is_dir && !menuInLibrary.value) return;
    renaming.value = {
      active: true,
      path: contextMenu.value.target.path,
      originalName: contextMenu.value.target.name,
      input: contextMenu.value.target.name,
    };
    hideContextMenu();
    nextTick(() => {
      const input = document.querySelector(".rename-input") as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    });
  }

  async function confirmRename() {
    if (!renaming.value.input || renaming.value.input === renaming.value.originalName) {
      cancelRename();
      return;
    }
    const newName = renaming.value.input;
    if (isInvalidName(newName)) {
      alert("名称包含非法字符，请使用有效的名称");
      cancelRename();
      return;
    }
    const oldPath = renaming.value.path;
    const newPath = joinPath(parentOf(oldPath), newName);
    try {
      await invoke("rename_path", { oldPath, newPath });
      remapTabsUnderDir(oldPath, newPath);
      const r = rootOfPath(oldPath);
      if (r) {
        const entry = findEntry(r, oldPath);
        if (entry) {
          updateSubtreePaths(entry, toPosix(oldPath), toPosix(newPath));
          entry.name = newName;
          if (entry.children) stampParents(entry.children, entry.path);
          const container = getChildrenOf(r, parentOf(newPath));
          if (container) sortEntries(container);
        } else {
          await loadRoot(r);
        }
      }
    } catch (e) {
      alert("重命名失败: " + e);
    }
    cancelRename();
  }

  function cancelRename() {
    renaming.value = { active: false, path: "", originalName: "", input: "" };
  }

  async function handleDelete() {
    const target = contextMenu.value.target;
    if (!target) return;
    if (target.is_dir && !menuInLibrary.value) return;
    const message = target.is_dir
      ? `确定要删除文件夹 "${target.name}" 及其所有内容吗？此操作不可撤销。`
      : `确定要删除文件 "${target.name}" 吗？此操作不可撤销。`;
    if (!window.confirm(message)) return;
    try {
      await invoke("delete_path", { path: target.path });
      closeTabsUnderPath(target.path);
      const r = rootOfPath(target.path);
      if (r) {
        const removed = removeEntry(r, target.path);
        if (!removed) await loadRoot(r);
      }
    } catch (e) {
      alert("删除失败: " + e);
    }
    hideContextMenu();
  }

  function isValidDrop(entry: FileEntry, dstDir: string): boolean {
    if (!entry.is_dir) return true;
    const n = toPosix(entry.path);
    const d = toPosix(dstDir);
    if (d === n || d.startsWith(n + "/")) return false;
    return true;
  }

  async function moveEntry(entry: FileEntry, srcRootKind: TreeRootKind, dstDir: string) {
    if (srcRootKind === "external" && entry.is_dir) {
      alert("外部文件夹不能移动");
      return;
    }
    if (!isValidDrop(entry, dstDir)) {
      alert("不能移动到自身或其子目录");
      return;
    }
    const newPath = joinPath(dstDir, basename(entry.path));
    if (toPosix(newPath) === toPosix(entry.path)) return;
    try {
      await invoke("move_path", { src: entry.path, dstDir });
      if (entry.is_dir) remapTabsUnderDir(entry.path, newPath);
      else remapTabPath(entry.path, newPath);
      const sr = rootOfPath(entry.path);
      const dr = rootOfPath(dstDir);
      let node: FileEntry | null = null;
      if (sr) node = removeEntry(sr, entry.path);
      if (node) {
        updateSubtreePaths(node, toPosix(entry.path), toPosix(newPath));
        node.parent = dstDir;
        if (node.children) stampParents(node.children, node.path);
      }
      if (dr) {
        if (node) {
          const ok = insertEntry(dr, dstDir, node);
          if (!ok) await loadRoot(dr);
        } else {
          await loadRoot(dr);
        }
      }
      if (sr && !node) await loadRoot(sr);
    } catch (e) {
      alert("移动失败: " + e);
    }
  }

  async function moveEntryTo(entry: FileEntry, rootKind: TreeRootKind) {
    if (rootKind === "external" && entry.is_dir) {
      alert("外部文件夹不能移动");
      return;
    }
    try {
      const dst = await open({ directory: true, multiple: false, defaultPath: entry.parent ?? undefined });
      if (!dst) return;
      await moveEntry(entry, rootKind, dst as string);
    } catch (e) {
      console.error("移动失败:", e);
    }
  }

  function onDragStart(entry: FileEntry, rootKind: TreeRootKind) {
    if (rootKind === "external" && entry.is_dir) return;
    dragging.value = { entry, rootKind };
  }

  function onNodeDragOver(event: DragEvent, target: FileEntry) {
    if (!dragging.value) return;
    if (!target.is_dir) return;
    if (!isValidDrop(dragging.value.entry, target.path)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    dragOverPath.value = target.path;
  }

  function onNodeDragLeave(target: FileEntry) {
    if (dragOverPath.value === target.path) dragOverPath.value = null;
  }

  async function onNodeDrop(target: FileEntry) {
    if (!dragging.value) return;
    const d = dragging.value;
    dragging.value = null;
    dragOverPath.value = null;
    if (!target.is_dir) return;
    await moveEntry(d.entry, d.rootKind, target.path);
  }

  function onDragEnd() {
    dragging.value = null;
    dragOverPath.value = null;
  }

  // 容器级拖拽落点(根目录 header):让根目录本身也能接收拖入
  function onContainerDragOver(event: DragEvent, dirPath: string) {
    if (!dragging.value) return;
    if (!isValidDrop(dragging.value.entry, dirPath)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    dragOverPath.value = dirPath;
  }

  async function onContainerDrop(dirPath: string) {
    if (!dragging.value) return;
    const d = dragging.value;
    dragging.value = null;
    dragOverPath.value = null;
    await moveEntry(d.entry, d.rootKind, dirPath);
  }

  return {
    openFile: (path: string) => deps.openFile(path),
    roots,
    libraryRoot,
    externalRoots,
    contextMenu,
    renaming,
    dragging,
    dragOverPath,
    menuInLibrary,
    menuTargetIsFolder,
    menuCanNewFile,
    menuCanNewFolder,
    menuCanRename,
    menuCanDelete,
    menuCanMove,
    init,
    ensureLibrary,
    reloadLibrary,
    migrateLibrary,
    addExternalRoot,
    openExternalFolder,
    closeExternalRoot,
    removeRecentFolder,
    reloadRoot,
    reloadPath,
    showContextMenu,
    showContextMenuOnTree,
    hideContextMenu,
    handleNewFile,
    handleNewFolder,
    handleRename,
    confirmRename,
    cancelRename,
    handleDelete,
    moveEntry,
    moveEntryTo,
    onDragStart,
    onNodeDragOver,
    onNodeDragLeave,
    onNodeDrop,
    onDragEnd,
    onContainerDragOver,
    onContainerDrop,
    remapTabPath,
    remapTabsUnderDir,
    closeTabsUnderPath,
  };
}

export type Workspace = ReturnType<typeof useWorkspace>;
export const workspaceKey: InjectionKey<Workspace> = Symbol("workspace");
