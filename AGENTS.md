# AGENTS.md — InkStone MD 开发指南

> 面向 AI 代理与新协作者的开发指南。InkStone MD 是 Tauri 2.x + Vue 3 桌面 Markdown 编辑器,当前主版本 1.6.0。

## 1. 项目概览

- **技术栈**:Vue 3 + TypeScript + Vite + TailwindCSS(前端)/ Tauri 2.x + Rust(后端)
- **代码结构**:
  - `src/App.vue`(~2150 行):tab 管理、快捷键、事件编排、预览交互绑定(bindXxx)
  - `src/components/`:SFC 组件(工具栏/Tab/编辑器/文件树/设置面板/灯箱/对话框)
  - `src/composables/`:`useWorkspace.ts`(双区文件树)、`useExport.ts`(导出/打印)
  - `src/utils/markdown.ts`:Markdown 渲染管线(md 实例 + 预处理 + `renderMarkdownHTML`,预览与导出共用)
  - `src/constants/`:主题与高亮选项(`options.ts`)、欢迎文档(`defaultContent.ts`)、导出 CSS(`exportCss.ts`)
  - `src/assets/markdown-body.css`:预览内容样式唯一真源
- **文档地图**:
  - `README.md`:面向使用者的特性/安装/快捷键(保持精炼)
  - `CHANGELOG.md`:版本更新日志(用户可感知变更)
  - `docs/roadmaps/`:各版本发布规划、决策记录、验收清单
  - `AGENTS.md`:本文件

## 2. 常用命令

```bash
npm run dev              # 仅前端 dev server (http://localhost:1420)
npm run tauri dev        # 完整 dev:前端 + Rust 后端,启用 devtools
npm run build            # vue-tsc 类型检查 + vite build(等价于 typecheck)
npm run tauri build      # 出 NSIS 安装包(Win 上需要管理员)
npm run preview          # 预览 dist/
cargo check              # 在 src-tauri/ 目录,验证 Rust 端
```

> 仓库**没有**独立的 lint / test / format 脚本。`vue-tsc --noEmit`(含在 `npm run build`)是唯一静态检查入口。
> 改了 `src-tauri/**` 只跑 `npm run build` 不够,必须再跑 `cargo check`。

## 3. 版本发布流程

1. **版本号三处同步**(缺一即 `tauri build` 失败):
   - `package.json` → `version`
   - `src-tauri/Cargo.toml` → `[package] version`
   - `src-tauri/tauri.conf.json` → `version`
2. **分支**:从 main 建 `release/vX.Y.Z`,开发与自测在该分支进行
3. **提交信息**:约定式前缀 + 中文摘要,如 `feat: 预览全面增强美化 (v1.6.0)`、`fix: 资源面板误识别代码示例`
4. **验证**:`npm run build` + `cargo check` + `npm run tauri dev` 实跑回归(清单见对应 ROADMAP)
5. **合并**:推送分支 → 建 PR 到 main → merge(merge commit 风格)
6. **发布**:GitHub Releases 建 tag `vX.Y.Z`(指向 main 合并提交),附更新说明;NSIS 安装包需管理员权限本地构建后上传 Assets
7. **文档同步**:发布时更新 `CHANGELOG.md` 新版本小节 + `docs/roadmaps/ROADMAP_VX.Y.Z.md` 落地记录;涉及架构/约定变化时同步本文件

## 4. 架构

### 4.1 前端

- **渲染管线(单源)**:`utils/markdown.ts` 的 `renderMarkdownHTML(source, heads, opts)` 固定顺序:md.render → mermaid 占位 → KaTeX(暂存 `<pre>/<code>` 防公式正则穿透)→ `addHeadingIds` → `embedMediaTags` →(interactive 时)图片/代码块/表格交互包装。
  - 预览:`extractFrontMatter` → `preprocessImageSrcs` → `preprocessToc` → `renderMarkdownHTML({ interactive: true })`
  - 导出/打印:`useExport` 内 `inlineImagesInMarkdown` → 同上管线(`{ mermaidFallback: true }`)
  - **新增渲染步骤只改这一处**,严禁在预览、导出两条链上各写一份(V1.5.0 前的双副本曾漂移出导出锚点失效 bug)
- **预览样式体系**:
  - `markdown-body.css` 是预览样式唯一真源,预览由 `main.ts` import,导出由 `useExport` 以 `?raw` 内联;`exportCss.ts` 只留外壳与打印分页
  - 颜色全走 `--ink-md-*` 变量:`:root` 浅色基线 → `.dark` 暗色基线 → `[data-theme=...]` 只覆写变量
  - 阅读偏好(字体/字号/行宽/高亮主题)通过 `<html>` **内联 style 写同名变量**实现覆盖;localStorage keys:`readerFont` / `readerFontSize` / `readerWidth` / `hljsTheme`
  - 导出时 `captureCurrentTheme` 用 `getComputedStyle(document.documentElement)` 读实时值——**不要**在 JS 里手抄主题色表
- **代码高亮**:hljs 走 `highlight.js/lib/common`(类型垫片 `types/hljs-common.d.ts`);预览配色由 `<style id="ink-hljs-theme">` 动态注入,选项与 CSS 映射在 `constants/options.ts`。不要恢复静态 `import "highlight.js/styles/xxx.css"`
- **滚动同步**:分栏双向比例同步,程序化滚动靠 `holdSyncLock` 互斥(单定时器可重置,100ms);开关持久化 `scrollSync`,`F7` 切换
- **输入防抖**:`renderedHTML` / `headings` / `wordCount` 读 250ms 防抖的 `renderContent`(切换 tab 立即同步);搜索 200ms 防抖;mermaid 按「主题+源码」增量渲染

### 4.2 Rust 端(`src-tauri/src/lib.rs`)

`pub fn run()` 是入口。已注册 16 个 `#[tauri::command]`:

| 命令 | 用途 |
|---|---|
| `read_file` / `write_file` | 文本读写 |
| `read_file_bytes` / `write_file_bytes` | 二进制读写 |
| `get_file_info` | 元信息(name + size) |
| `read_directory` | 递归扫目录(忽略 `.` 开头) |
| `create_file` / `create_directory` / `rename_path` / `delete_path` | 文件树 CRUD |
| `move_path` | 移动文件/文件夹(跨盘符 copy+delete 回退) |
| `reveal_in_folder` | 资源管理器定位/打开(见 §5 Windows 专项) |
| `ensure_library` | 初始化/获取应用内库根(app data 默认,可迁移) |
| `migrate_library` | 迁移库根(搬移文档 + 更新 store) |
| `compress_image` | JPEG/PNG 重编码(`image` crate) |
| `frontend_ready` | 前端握手,见 §5 |

**插件**(Cargo.toml 与 lib.rs 都要加,缺一运行期 panic):
- `tauri-plugin-single-instance`:必须在所有插件**最前面**(第二次双击 .md 时前置窗口并下发文件)
- `tauri-plugin-dialog` / `tauri-plugin-fs`:文件选择 + 文件系统
- `tauri-plugin-deep-link`:`schemes: ["inkstone"]` 已注册,协议跳转未启用
- `tauri-plugin-store`:配置持久化(`libraryPath` / `recentFolders`);须在 single-instance **之后**注册
- `tauri` crate 必须开 `features = ["devtools", "protocol-asset"]`(后者是 `convertFileSrc` 的前提)

## 5. 关键链路与陷阱

### 前后端握手(双击 .md 打开)

1. 启动时 `lib.rs` 的 `StartupFile` state 挂着 `pick_openable_path(std::env::args())` 选出的待开文件
2. 前端 `onMounted` 末尾 `emit("frontend-ready")`
3. 后端监听到后 `dispatch_open_file` → `emit("open-file", path)`
4. 前端 `listen("open-file", ...)` 统一处理(含运行期单实例回调的二次打开)

`pick_openable_path` 接受 `.md` / `.markdown` / `.txt`;`tauri.conf.json` 的 `fileAssociations` 必须同步列这三个。

### 图片本地化(改一处要检查整条链)

1. markdown 必须在 `md.render` **之前**把 `![alt](src)` 的 src 预处理为 `asset://localhost/...`(`convertFileSrc`,在 `preprocessImageSrcs`)
2. http/https/data 原样;绝对/UNC 直接转;相对路径按 tab 文件目录 resolve 后转
3. `tauri.conf.json` 需 `app.security.assetProtocol: { enable: true, scope: ["**"] }`
4. `Cargo.toml` 的 tauri feature 含 `protocol-asset`
5. `capabilities/default.json` 需 `fs:allow-read-file` 的 `**` 兜底

### 前端陷阱

- **Vue const 无提升**:被其他 `computed`/`watch` 引用的 ref 必须先声明,否则运行期 `ReferenceError before initialization`,`vue-tsc` 抓不到——改完必须 `tauri dev` 实跑
- **textarea 选区不触发 document 级 `selectionchange`**(WebView2):"选中 N 字"统计挂 textarea **元素级**事件;document 级只负责把非编辑器选区清零
- **资源面板扫描**先 `stripCodeSegments` 跳过 fenced/行内代码,反引号里的 `![](demo.mp4)` 语法示例不是真实引用
- **同步锁定时器必须单实例可取消**:否则连续滚动时旧定时器提前解锁,双向回写抖动
- **mermaid** 已渲染图按 `data-rendered="主题|源码"` 跳过;主题切换要换 key 重渲染,否则不换肤
- **front-matter 元信息卡内部禁用 h1-h6**(会破坏 `addHeadingIds` 的顺序对齐)

### Windows 专项

- 安装器 `installMode: "perMachine"` 需管理员,是双击文件关联稳定生效的前提(Win 10 HKCU 关联优先级有坑)
- 路径混用:`std::path::Path` 得到 `\`,Tauri/前端要 `/`,转 `convertFileSrc` 前记得 `.replace(/\\/g, '/')`
- `reveal_in_folder` **必须用 `raw_arg` 手工控制引号**:目录 `explorer "<dir>"`,文件 `/select,"<path>"`——`Command::arg` 对含空格参数整体加引号,explorer 的 `/select` 不接受,会回落打开"文档"文件夹
- `vue-tsc` 报 `:deep` 警告(lightningcss)是 Vue scoped CSS 已知噪音,不影响构建

## 6. 文档维护约定

| 变更类型 | 需要动 |
|---|---|
| 用户可感知的新功能/修复 | `CHANGELOG.md`(对应版本小节或 Unreleased) |
| 版本发布 | 三处版本号 + `CHANGELOG.md` + `docs/roadmaps/ROADMAP_VX.Y.Z.md` |
| 架构/管线/约定变化 | 本文件对应小节 |
| 新特性/快捷键 | `README.md` 特性与快捷键表(保持精炼,细节进 CHANGELOG) |

改某个版本相关工作前,先扫 `docs/roadmaps/` 里该期的「范围外/遗留项」,避免重复劳动。
