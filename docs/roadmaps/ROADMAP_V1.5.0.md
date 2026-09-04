# InkStone MD V1.5.0 发布规划

> **目标**：把侧边栏文件树从「单临时根」重构为**双区模型**——
> ① **应用内库**：默认根节点 = `app_data_dir` 固定目录（开箱即用），用户可「迁移库」到自选路径；支持文件/文件夹的完整 CRUD + 移动。
> ② **外部文件夹**：从应用外打开的目录，**只读文件夹结构、仅可操作文件**（不能新建/重命名/删除/移动文件夹），持久化最近列表 + 重启自动恢复。
>
> 顺势把文件树逻辑从 `App.vue` 抽离为 `useWorkspace.ts` composable + `TheSidebar.vue` + 递归 `TreeNode.vue`（`ROADMAP_V1.4.0` 已规划、本期落地）。
>
> 本期 Rust 端有改动：新增 `tauri-plugin-store` + 3 个命令（`ensure_library` / `migrate_library` / `move_path`）。

## 一、版本基线

| 项 | 当前 (1.4.0) | 目标 (1.5.0) |
|---|---|---|
| `package.json` version | 1.4.0 | **1.5.0** |
| `src-tauri/Cargo.toml` version | 1.4.0 | **1.5.0** |
| `src-tauri/tauri.conf.json` version | 1.4.0 | **1.5.0** |
| 分支 | `main`（已发布 1.4.0） | `release/v1.5.0`（本期） |
| Tag | `v1.4.0` 已存在 | `v1.5.0`（构建并自测通过后打） |

> 三处 version 必须**同步**改，缺一即 `tauri build` 失败。规则见 `AGENTS.md`「版本号必须三处同步」。

## 二、决策记录（已与产品对齐）

| 决策点 | 结论 |
|---|---|
| 默认根节点物理位置 | **混合方案**：首次启动用 `app_data_dir/InkStoneMD/library` 自动建库；提供「迁移库」入口，用户可把库根迁到自选目录（含文件搬迁） |
| 外部文件夹持久化 | **持久化最近打开的 + 重启恢复**，路径失效则标灰可移除 |
| 移动交互 | **树内拖拽**（主）+ **右键「移动到…」**（辅） |
| 组件抽离 | **顺势抽离** `useWorkspace.ts` + `TheSidebar.vue` + `TreeNode.vue` |

## 三、现状缺口（来自代码测绘）

| 缺口 | 位置 | 影响 |
|---|---|---|
| `workspacePath` 是单值 string，**纯内存态、重启即丢** | `App.vue:148` | 无法支撑「应用内自带库」与多根 |
| **无「库/工作区/根节点」概念**，无默认根目录 | — | 双区模型的根本前提缺失 |
| **无移动能力**（树内无 `draggable`，`rename_path` 仅原地改名） | `App.vue:485-546`、`lib.rs:133-144` | 需新增拖拽 + 菜单移动 |
| 无配置文件，设置散落 localStorage | 全局 | 库路径 / 最近文件夹无处持久化 |
| `renderFileTree` 用 `h()` 手写递归、文件树逻辑全在 App.vue | `App.vue:485-546` | 双区渲染需重构，顺势抽离 |
| 每次 CRUD 后 `loadFileTree()` **整树重拉** | `App.vue:1528/1553/1604/1640` | 大库性能差，顺带优化 |
| 外部文件夹无权限边界（当前根下可任意 CRUD） | `App.vue:1510-1651` | 易误操作系统文件夹 |
| `rename_path` = `std::fs::rename`，**跨盘符失败**（Win） | `lib.rs:133-144` | 移动场景必须处理 copy+delete 回退 |

## 四、任务分解（10 阶段）

### 阶段 0 — 版本基线 ✅
- 0.1 三处版本号 `1.4.0` → `1.5.0`
- 0.2 建 `release/v1.5.0` 分支

### 阶段 1 — Rust 端基础设施
- **1.1 引入 `tauri-plugin-store`**：`Cargo.toml` 加依赖；`lib.rs` 在 `setup` 注册（必须在 `single-instance` **之后**、其他插件前）；`capabilities/default.json` 补 `store:allow-*`。
  - 配置项聚焦 `libraryPath` / `recentFolders`，**不**迁移现有 localStorage（控范围）。
- **1.2 库目录管理命令**
  - `ensure_library()`：启动握手阶段读 store 的 `libraryPath`；为空则 `app_data_dir()/InkStoneMD/library` 建默认库并写回；确保目录存在；返回路径。
  - `migrate_library(new_path)`：校验目标（空/可写）→ 移动现有库内容到新路径 → 更新 store → 返回新路径。
- **1.3 新增 `move_path(src, dst_dir)` 命令**：先 `std::fs::rename`，**跨盘符失败回退** `copy_dir_all + remove`。
- 1.4 `capabilities/default.json` 补 `fs` 读写 scope 到库路径与 `**`。

### 阶段 2 — 数据模型
- **2.1 `src/types/index.ts` 扩展**：
  - `type TreeRootKind = 'library' | 'external'`
  - `interface TreeRoot { kind: TreeRootKind; path: string; label: string; entries: FileEntry[]; }`
  - `interface AppConfig { libraryPath: string; recentFolders: string[]; }`
- 2.2 `FileEntry` 增加 `parent?: string`（拖拽落点校验 / 增量更新需要），`is_open` 保留。

### 阶段 3 — `useWorkspace.ts` composable 抽离
- 3.1 新建 `src/composables/useWorkspace.ts`，从 App.vue 迁入：`workspacePath`→改为 `roots: Ref<TreeRoot[]>`、`fileTree`、`loadFileTree`、`openFolder`、右键 CRUD、`contextMenu`、`renaming`、`isInvalidName`。
- 3.2 暴露 API：`roots`、`libraryRoot`(computed)、`externalRoots`(computed)、`openExternalFolder`、`closeExternalRoot`、`ensureLibrary`、`migrateLibrary`、`moveEntry`。
- 3.3 App.vue 引用改为 `const { roots, ... } = useWorkspace()`。
- > **注意 AGENTS.md 引用顺序陷阱**：composable 内 const 顺序与原 App.vue 一致，先定义被引用的 ref；`vue-tsc` 抓不到运行时引用顺序错误，改完必跑 `tauri dev`。

### 阶段 4 — `TheSidebar.vue` + 递归 `TreeNode.vue`
- 4.1 新建 `src/components/TheSidebar.vue`：承载整个侧边栏（4 个 mode tab + 内容区 + 右键菜单 DOM），App.vue 仅 `<TheSidebar />` 占位。
- 4.2 新建 `src/components/TreeNode.vue`（**真正递归 SFC**，替换 `renderFileTree` 的 `h()`）。Props：`entry`、`root`、`depth`；递归 `<TreeNode>` 渲染 children。
- 4.3 右键菜单改为组件内，按 `root.kind` 动态显示菜单项。

### 阶段 5 — 双区树核心（本期重点）
- **5.1 多根模型**：`roots` 数组，库根恒为 `roots[0]` 且不可关闭；外部根追加在后。
- **5.2 启动恢复**：`onMounted` 调 `ensure_library()` 渲染库根 → 读 store `recentFolders` 恢复外部根。
- **5.3 权限分层**（核心规则，`TreeNode` + 右键菜单统一执行）：

| 操作 | 库根 (kind=library) | 外部根 (kind=external) |
|---|---|---|
| 新建文件 | ✅ | ✅ |
| 新建文件夹 | ✅ | ❌ |
| 重命名文件 | ✅ | ✅ |
| 重命名文件夹 | ✅ | ❌ |
| 移动（文件/文件夹） | ✅ 全部 | ✅ 仅文件 |
| 删除文件 | ✅ | ✅ |
| 删除文件夹 | ✅ | ❌ |

- 5.4 根节点行 UI：库根显示「我的库」标题 + 操作按钮（在资源管理器打开 / 刷新 / 更多[迁移库]）；外部根显示文件夹名 + 关闭(×) + 在资源管理器打开。
- 5.5 空态：库根为空时显示「开始新建你的第一篇文档」引导。

### 阶段 6 — 移动功能
- **6.1 树内拖拽**（`TreeNode.vue`）：`draggable` + `dragstart` 记录源 entry + 其 `root.kind`；`dragover` 实时高亮目标文件夹 + `drop` 落点；**落点合法性校验**：① 不能拖入自身或自身子树 ② 外部根文件夹不可拖动 ③ 外部根内目标必须是文件夹 ④ 跨根移动允许（库↔外部）。
- **6.2 右键「移动到…」**：弹 `open({directory:true})` 选目标目录 → `invoke('move_path')`。
- 6.3 移动成功后：更新已开 tab 的 `path`/`name`（沿用现有重命名同步逻辑 `App.vue:1607-1611` 模式），失败（被占用/权限）明确报错。

### 阶段 7 — 外部文件夹持久化
- 7.1 `openExternalFolder` 成功后写入 store `recentFolders`（去重、上限 5）。
- 7.2 启动恢复每个 recentFolder；读树时捕获异常 → 路径失效则侧边栏标灰 + 「路径已失效，点击移除」。
- 7.3 关闭外部根（×）= 仅从当前会话移除（保留在 recent）；「移除最近记录」单独入口。

### 阶段 8 — 库迁移
- 8.1 库根「更多」菜单 →「迁移库到…」
- 8.2 流程：选目录 → 二次确认（提示会移动所有文档）→ `migrate_library` → 前端重载库根树 → **批量重映射已开 tab 路径**（旧库前缀 → 新库前缀替换）→ 刷新资产面板。
- 8.3 迁移中断/失败回滚：先复制成功再删源（`move_path` 同款 copy-then-delete），失败保留源不删。

### 阶段 9 — 增量更新（可选，性能优化）
- 9.1 CRUD / 移动成功后**局部更新树节点**（增删改 `children`），不再 `loadFileTree()` 全量重拉。仅「刷新」按钮走全量。

### 阶段 10 — 验收与发布
- 10.1 `npm run build`（含 `vue-tsc --noEmit`，唯一静态检查）
- 10.2 `cargo check`（在 `src-tauri/`，验证 Rust 新命令）
- 10.3 `npm run tauri dev` 实跑回归清单（见下）
- 10.4 `npm run tauri build` 出 NSIS 包，打 `v1.5.0` tag

## 五、回归测试清单（dev 实跑必过）
1. 首次启动 → 自动出现「我的库」根，底层指向 app data dir
2. 库内：新建文件/文件夹、重命名、删除、拖拽移动、右键「移动到…」全链路
3. 拖拽到自身子树 → 被拒绝；拖拽跨盘符 → copy+delete 成功
4. 打开外部文件夹 → 仅能新建/重命名/删除**文件**，文件夹操作菜单项消失/灰显
5. 外部文件夹拖动文件夹 → 被拒绝
6. 重启应用 → 库根 + 最近外部文件夹自动恢复
7. 外部文件夹路径失效 → 标灰 + 可移除，不崩溃
8. 迁移库到新目录 → 文档跟随、已开 tab 路径更新、原位置清空
9. 图片本地化链路（`asset://` 转换）在库内/外部文档均正常（`AGENTS.md` 链路不能破坏）
10. 单实例 + 双击 .md 打开握手链路不受影响

## 六、关键风险与对策

| 风险 | 对策 |
|---|---|
| `std::fs::rename` 跨盘符失败（Win） | `move_path` 强制走 copy+delete，不依赖 rename |
| 迁移库导致已开 tab 路径全失效 | 迁移后按旧/新前缀批量重映射 `tab.path`，重映射失败则标 tab 失效 |
| 外部根误删系统文件夹 | 权限边界 5.3 严格落地，右键菜单按 `root.kind` 动态裁剪，文件夹操作仅库根可见 |
| `store` 插件注册顺序 | `lib.rs` 中必须在 `single-instance` 之后注册（`AGENTS.md` 要求） |
| Vue 引用顺序运行时崩溃 | composable 内 const 顺序与原 App.vue 保持；改完必跑 `tauri dev`（`vue-tsc` 抓不到） |
| 全量重拉性能 | 阶段 9 增量更新兜底；树深时懒加载留 1.6.0 |

## 七、范围外（不在 1.5.0）
- 多库 / 多 vault（决策点已选单库）
- 文件树搜索过滤、展开/折叠全部
- 迁移现有 localStorage 设置到 store
- 懒加载大目录（留后续）
