# AGENTS.md

> InkStone MD 是一个 Tauri 2.x + Vue 3 桌面 Markdown 编辑器,目前主版本 1.0.0。所有编辑/预览/资源管理/主题逻辑集中在 `src/App.vue` 一个文件里(约 3500 行),没有拆分组件目录。

## 命令速查

```bash
npm run dev              # Vite 前端 dev server (http://localhost:1420)
npm run tauri dev        # 完整 dev:前端 + Rust 后端,启用 devtools
npm run build            # vue-tsc 类型检查 + vite build(等价于 typecheck)
npm run tauri build      # 出 NSIS 安装包(Win 上需要管理员)
npm run preview          # 预览 dist/
```

> 仓库**没有**独立的 lint / test / format 脚本。`vue-tsc --noEmit` 是唯一的静态检查入口,已经包在 `npm run build` 里。
> 修改 `src-tauri/**` 之后只跑 `npm run build` 不够,还需要 `cargo check`(在 `src-tauri/` 目录)验证 Rust 端。

## 版本号必须三处同步

发版时这三处必须**同时**改,缺一即 `tauri build` 会失败或产物版本错乱:
- `package.json` → `version`
- `src-tauri/Cargo.toml` → `[package] version`
- `src-tauri/tauri.conf.json` → `version`

## 关键架构事实

### Rust 端(`src-tauri/src/lib.rs`)

`pub fn run()` 是入口,由 `main.rs` 调用。已注册的 `#[tauri::command]` 共 13 个:

| 命令 | 用途 |
|---|---|
| `read_file` / `write_file` | 文本读写 |
| `read_file_bytes` / `write_file_bytes` | 二进制读写 |
| `get_file_info` | 元信息(name + size) |
| `read_directory` | 递归扫目录(忽略 `.` 开头) |
| `create_file` / `create_directory` / `rename_path` / `delete_path` | 文件树 CRUD |
| `reveal_in_folder` | 资源管理器中定位(Win/macOS/Linux 三分支) |
| `compress_image` | JPEG/PNG 重编码,走 `image` crate |
| `frontend_ready` | 前端握手,见下文 |

### Tauri 插件

`Cargo.toml` 与 `lib.rs` 都得加,缺一报运行期 panic:
- `tauri-plugin-single-instance`:必须在所有插件**最前面**注册,负责"第二次双击 .md 时把窗口前置并下发文件"
- `tauri-plugin-dialog` / `tauri-plugin-fs`:文件选择 + 文件系统
- `tauri-plugin-deep-link`:`schemes: ["inkstone"]` 已在 `tauri.conf.json` 注册,本期未启用协议跳转
- `tauri` crate 必须开 `features = ["devtools", "protocol-asset"]`,后者是本地图片走 `convertFileSrc` 转换 `asset://` 协议的前提

### 前后端握手(双击 .md 打开)

事件名易混淆,必须按这套来:

1. 启动时,`lib.rs` 的 `StartupFile` state 里挂着一个 `pick_openable_path(std::env::args())` 选出的待开文件
2. 前端在 `onMounted` 末尾 `emit("frontend-ready")`
3. 后端 `app.listen("frontend-ready", ...)` 收到后调用 `dispatch_open_file` → `emit("open-file", path)`
4. 前端 `listen("open-file", ...)` 统一处理(包含运行期单实例回调里的第二次打开)

**`pick_openable_path` 接受的扩展名**:`.md` / `.markdown` / `.txt`。`tauri.conf.json` 的 `fileAssociations` 也必须同步列这三个,否则双击不进应用或参数被丢。

### 图片本地化

本地图片渲染链路(改一处就要检查整条链):
1. 原始 markdown 必须在 `md.render` **之前**用正则把 `![alt](src)` 里的 `src` 预处理为 `asset://localhost/...`(用 `convertFileSrc` from `@tauri-apps/api/core`)
2. 绝对/UNC/相对三类路径分别处理:`URL(http/https/data:)` 原样,`Windows 绝对/UNC` 直接转,`相对` 用 `tab.path` 所在目录 `path.resolve` 后再转
3. `tauri.conf.json` 必须有 `app.security.assetProtocol: { enable: true, scope: ["**"] }`
4. `Cargo.toml` 的 `tauri` feature 必须含 `protocol-asset`
5. `capabilities/default.json` 需要 `fs:allow-read-file` 的 `**` scope 兜底

## Vue 3 组合式 API 关键陷阱

`const` 不会提升,引用必须按依赖顺序声明,否则 setup 阶段就报:

```
Uncaught ReferenceError: Cannot access 'X' before initialization
    at ComputedRefImpl.fn (App.vue:NNN)
```

实际踩坑:`renderedHTML` computed 在 line ~1100 用了 `headings.value`,但 `headings` 原本定义在 line ~1130,setup 阶段先执行 `renderedHTML` 的 getter 就炸了。修复就是**把 `headings` 提到 `renderedHTML` 之前**。

规则:**所有被其他 `computed` / `watch` 引用到的 `ref` / `computed`,必须在被引用者之前定义**。这类 bug 不会被 `vue-tsc` 抓到(运行时报错才暴露),改完务必 `npm run tauri dev` 实跑。

## Windows 专项

- 安装器 `installMode: "perMachine"` 需要管理员权限,但这是双击 .md 文件关联能稳定生效的前提(Win 10 HKCU 关联优先级有坑)
- 路径混用:`std::path::Path` 拿到的是 `\`,但 Tauri 内部要 `/`,传 `convertFileSrc` / 写 `asset://` 之前记得 `.replace(/\\/g, '/')`
- `reveal_in_folder` 用 `explorer /select,<path>`,**不要**手工加引号 — Rust 的 `Command::arg` 会自动处理含空格的路径
- `vue-tsc` 报 `:deep` 警告(`lightningcss minify 'deep' is not a valid pseudo-class`)是 Vue scoped CSS 已知噪音,不影响构建

## 发布参考

`ROADMAP_V1.0.0.md` 里有当前版本的发布清单、BUG 修复记录和剩余工作项,改之前先扫一眼避免重复劳动。

## 注意事项

- 每次更新整理 `README.md` 时，需要把特性、版本记录分别提取为单独章节，其他按需整理。
