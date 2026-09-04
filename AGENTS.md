# AGENTS.md

> InkStone MD 是一个 Tauri 2.x + Vue 3 桌面 Markdown 编辑器,目前主版本 1.6.0。视图层已拆分为 `src/components/` 下多个 SFC 组件(工具栏/Tab/编辑器/文件树/对话框/设置面板/灯箱等);文件树逻辑在 `src/composables/useWorkspace.ts`,导出/打印管线在 `src/composables/useExport.ts`,Markdown 渲染管线在 `src/utils/markdown.ts`;`src/App.vue`(~2100 行)保留 tab 管理、快捷键、事件编排与预览交互绑定。

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

`pub fn run()` 是入口,由 `main.rs` 调用。已注册的 `#[tauri::command]` 共 16 个:

| 命令 | 用途 |
|---|---|
| `read_file` / `write_file` | 文本读写 |
| `read_file_bytes` / `write_file_bytes` | 二进制读写 |
| `get_file_info` | 元信息(name + size) |
| `read_directory` | 递归扫目录(忽略 `.` 开头) |
| `create_file` / `create_directory` / `rename_path` / `delete_path` | 文件树 CRUD |
| `move_path` | 移动文件/文件夹到目标目录(跨盘符 copy+delete 回退) |
| `reveal_in_folder` | 资源管理器中定位/打开(目录直接打开内容,文件定位选中) |
| `ensure_library` | 初始化/获取应用内库根目录(app data 默认,可迁移) |
| `migrate_library` | 迁移库根到新目录(搬移文档 + 更新 store) |
| `compress_image` | JPEG/PNG 重编码,走 `image` crate |
| `frontend_ready` | 前端握手,见下文 |

### Tauri 插件

`Cargo.toml` 与 `lib.rs` 都得加,缺一报运行期 panic:
- `tauri-plugin-single-instance`:必须在所有插件**最前面**注册,负责"第二次双击 .md 时把窗口前置并下发文件"
- `tauri-plugin-dialog` / `tauri-plugin-fs`:文件选择 + 文件系统
- `tauri-plugin-deep-link`:`schemes: ["inkstone"]` 已在 `tauri.conf.json` 注册,本期未启用协议跳转
- `tauri-plugin-store`:配置持久化(库路径 `libraryPath` / 最近外部文件夹 `recentFolders`),前端 `@tauri-apps/plugin-store` 的 `LazyStore("settings.json")` + Rust `app.store("settings.json")`;注册须在 `single-instance` **之后**
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

### 预览样式体系(V1.6.0 起)

- **唯一真源**:`src/assets/markdown-body.css` 承载全部 `.markdown-body` 预览内容样式。预览由 `main.ts` 正常 import;导出 HTML/PDF 由 `useExport.ts` 以 `?raw` 内联。**改预览样式只改这一个文件**(`constants/exportCss.ts` 只有 `EXPORT_SHELL_CSS` 外壳与 `PRINT_CSS` 打印分页),不要再手工复制 markdown 样式进去。全局滚动条样式在 `style.css`(必须全局,scoped 选择器命中不了子组件的滚动容器)。
- **主题 = CSS 变量**:全部颜色走 `--ink-md-*` 变量,`:root` 浅色基线、`.dark` 暗色基线、`[data-theme=...]` 块只覆写变量值。新增主题只需加变量块,不要写元素级颜色覆盖。
- **阅读偏好(字体/字号/行宽/高亮主题)**通过在 `<html>` 上**内联 style 写同名变量**实现用户级覆盖(同元素内联必胜主题规则);"跟随主题"档不写内联属性。持久化在 localStorage(`readerFont`/`readerFontSize`/`readerWidth`/`hljsTheme`);导出时 `captureCurrentTheme` 用 `getComputedStyle(document.documentElement)` 直接读实时生效值注入产物(**不要**在 JS 里手抄主题色表,会和 CSS 漂移)。
- **代码高亮**:hljs 走 `highlight.js/lib/common`(类型垫片在 `src/types/hljs-common.d.ts`);预览配色由 `<style id="ink-hljs-theme">` 动态注入(`applyHljsTheme`),`auto` 档跟随亮暗。CSS 与选项表在 `constants/options.ts`(`getHljsThemeCss`)。不要恢复静态 `import "highlight.js/styles/xxx.css"`。
- **front-matter / 音视频**:都在 `utils/markdown.ts` 管线里(`extractFrontMatter`/`embedMediaTags`);front-matter 元信息卡内部禁用 h1-h6(会破坏 `addHeadingIds` 的顺序对齐)。

### Markdown 渲染管线(V1.6.0 优化后,单源)

`src/utils/markdown.ts` 导出 `md` 实例与整条纯函数管线,**预览与导出共用**:

- 预览(App.vue `renderedHTML`):`extractFrontMatter` → `preprocessImageSrcs` → `preprocessToc` → `renderMarkdownHTML(pre2, headings, { interactive: true })`
- 导出/打印(useExport):`inlineImagesInMarkdown` → `extractFrontMatter` → `preprocessToc` → `renderMarkdownHTML(source, headings, { mermaidFallback: true })`

`renderMarkdownHTML` 内部固定顺序:md.render → mermaid 占位 → KaTeX(暂存 `<pre>/<code>` 防公式正则穿透)→ `addHeadingIds` → `embedMediaTags` → (interactive 时)图片/代码块/表格交互包装。**新增渲染步骤只改这一处**,不要再在预览、导出两条链上各写一份(1.5.0 前的教训:两份副本已漂移出导出锚点失效 bug)。DOM 交互绑定(bindXxxToolbar/bindImageLightbox/bindHeadingAnchors 等依赖 App 状态的函数)留在 App.vue。

### 前端陷阱补充

- **textarea 选区不触发 document 级 `selectionchange`**(WebView2/部分 Chromium):统计"选中 N 字"必须挂 textarea **元素级** `selectionchange` 事件(见 App.vue onMounted);document 级监听只负责把非编辑器选区清零。
- **滚动同步锁必须单定时器可取消**:程序化滚动会触发对方窗格的回声 scroll 事件,靠 `holdSyncLock` 互斥;若每次同步 `setTimeout` 新起定时器不清旧的,连续滚动时旧定时器提前解锁,双向回写抖动。
- **mermaid 已渲染图按 `主题|源码` 跳过**(`data-rendered` 属性):主题切换需换 key 重渲染,否则切深浅色图表不换肤。

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
- `reveal_in_folder`:目录 `explorer "<dir>"` 打开内容,文件用 `/select,"<path>"` 定位;**必须用 `raw_arg` 手工控制引号**——`Command::arg` 会对含空格参数整体加引号,而 explorer 的 `/select` 不接受整体引号,路径带空格时打开失败(表现为回落到"文档"文件夹)
- `vue-tsc` 报 `:deep` 警告(`lightningcss minify 'deep' is not a valid pseudo-class`)是 Vue scoped CSS 已知噪音,不影响构建

## 发布参考

`ROADMAP_V1.0.0.md` 里有当前版本的发布清单、BUG 修复记录和剩余工作项,改之前先扫一眼避免重复劳动。

## 注意事项

- 每次更新整理 `README.md` 时，需要把特性、版本记录分别提取为单独章节，其他按需整理。
