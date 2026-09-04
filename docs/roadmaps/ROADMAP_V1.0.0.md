# InkStone MD V1.0.0 发布规划

> 目标:发布高完成度的初始版本,以可日常使用为标准,先解决阻塞性 BUG,再补齐 Typora 同类核心体验。

## 一、版本基线

| 项 | 当前 | 目标 |
|---|---|---|
| `package.json` version | 0.1.2 | 1.0.0 |
| `src-tauri/tauri.conf.json` version | 0.1.2 | 1.0.0 |
| 分支 | main | `release/v1.0.0` |
| Tag | — | `v1.0.0`(构建并自测通过后打) |

## 二、阻塞性 BUG 修复

### BUG 1 · 图片无法显示

**现象**
- 通过工具栏"插入图片"或拖拽图片后,在预览区图片区域空白、显示破图占位。
- 复制粘贴 Markdown 图片语法同样无法显示。

**根因分析**(基于 `src/App.vue:296` 与 `src-tauri/tauri.conf.json`)
1. Markdown 渲染走 `markdown-it` 默认流程,会自动把 `![alt](path)` 转成 `<img src="path">`;随后那行 `html.replace(/!\[...\(...\)/g, ...)` 实际是在已经渲染的 HTML 上匹配,匹配不到原语法,等于无效替换,且会把已经在 HTML 里的 `<img>` 标签内联属性打乱。
2. 即使替换成功,`<img src="C:\Users\xx\image.png">` 在 Tauri WebView 里也加载不到本地资源:Tauri 2 默认禁止 `file://` 协议访问本地磁盘,需要使用 `convertFileSrc()` 把本地路径转成 `tauri://localhost/...` 或 `asset://localhost/...`,并通过 `app.security.assetProtocol` 显式放行。
3. 当前 `capabilities/default.json` 与 `tauri.conf.json` 都没有配置 `assetProtocol`,也没有 `fs:allow-read-file` 的合理 scope(只有 `**` 的兜底),导致 webview 拒绝读取图片。

**修复方案**
- `src-tauri/tauri.conf.json`
  - 在 `app.security` 下新增 `assetProtocol: { enable: true, scope: ["**"] }`,允许任意磁盘路径作为 `tauri://localhost/...` 资源访问。
- `src/App.vue`
  - 引入 `convertFileSrc` from `@tauri-apps/api/core`。
  - 在 `renderedHTML` computed 中,**先**对原始 markdown 做预处理(在 `md.render` 之前)用正则匹配 `![alt](src)`,把本地 `src`(绝对路径、相对路径、URL 三类)分流:
    - URL(http/https/data:) 原样输出
    - Windows 绝对路径/UNC 路径 → `convertFileSrc(path)`
    - 相对路径 → 用当前激活标签的 `tab.path` 所在目录 `path.resolve(dir, src)`,再 `convertFileSrc()`
  - 删除原有 `html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, ...)` 这条在已渲染 HTML 上重复处理的代码(它本就是无效且会破坏 `<img>` 标签的)。
  - 在 `nextTick` 渲染完成后,检查 `<img>` 的 `complete` 与 `naturalWidth`,加载失败时给出占位提示。
- `src-tauri/capabilities/default.json`
  - 保留 `fs:allow-read-file` `**` 的兜底,确保 `convertFileSrc` 转换后能通过 webview 校验。

**自测用例**
- [ ] 工具栏插入本地 PNG,预览区正确显示。
- [ ] 拖拽外部图片到编辑器,自动拷贝到文档同目录、相对引用,显示正常。
- [ ] 网络图片 `https://...` 正常显示。
- [ ] base64 data URI 正常显示。
- [ ] 关闭并重开文件,路径仍然有效。
- [ ] PDF 导出中图片能正常被 html2canvas 截到(配合 `useCORS`/`allowTaint`)。

---

### BUG 2 · Win 10 双击 .md 文件无法加载到应用中

**现象**
- 在资源管理器中双击 .md 文件,要么 InkStone MD 没启动、要么启动了新窗口但没有把文件加载进去。
- 若 InkStone MD 已经在运行,双击 .md 仍会启动第二个进程,文件依然加载不到现有窗口。

**根因分析**(基于 `src-tauri/src/lib.rs:180-199` 与 `src-tauri/tauri.conf.json:36-48`)
1. **缺少单实例插件**:`tauri-plugin-single-instance` 没有引入,所以每次双击都拉起新进程,文件只在"当前那个新进程"里被处理;若 Windows shell 在多实例情况下对参数传递做了处理(例如把命令行截断),文件就不会出现在 args 中。
2. **NSIS 安装模式**:`installMode: "currentUser"` 在 Win 10 上注册文件关联时,有时不会调用 `ShellExecute` 传完整路径;且 Win 10 对 HKCU 关联的优先级处理有差异。改为 `perMachine` 配合管理员权限,或保留 `currentUser` 但在安装器里显式写 `WriteRegStr` 写入 `Software\Classes\.md`(对当前用户仍有效),更稳。
3. **事件发送时序**:500ms 固定延迟在 Win 10 慢机上不一定够,前端 `onMounted` 里 `await listen("open-file-init", ...)` 也有可能在事件 emit 之后才注册监听,导致丢失。
4. **事件机制不规范**:Tauri 2 提供了 `RunEvent::Opened { urls }`(macOS)与启动时的 `argv` 事件,但 Windows 上需要靠 `tauri-plugin-deep-link` + `single-instance` 配合 `argv` 事件来传文件路径,目前的实现只做了"启动时一次性读 args",没有"运行时再开第二个文件"的能力。
5. **args 解析不健壮**:Win 10 路径中可能带空格、引号;若启动器转义不规范,`args[1]` 可能不是真实路径。需要用 `CommandLineToArgvW` 思路解析或至少对引号做处理。

**修复方案**
- `src-tauri/Cargo.toml`:新增依赖
  - `tauri-plugin-single-instance = "2"`
  - `tauri-plugin-deep-link = "2"`(为后续支持 `inkstone://` 协议留口子,本次先用其文件打开能力)
- `src-tauri/tauri.conf.json`
  - `bundle.fileAssociations` 扩展为 `[ "md", "markdown", "txt" ]`,与 `lib.rs` 中的检测对齐。
  - `bundle.windows.nsis.installMode` 改为 `perMachine`,让安装器以管理员权限注册全局文件关联。
  - `plugins` 字段添加 `deep-link` 配置(本期先不接 protocol,只接 file 关联)。
- `src-tauri/capabilities/default.json`
  - 增加 `deep-link:default` 与 `core:event:default` 权限,允许前端监听文件打开事件。
- `src-tauri/src/lib.rs`
  - 在 `tauri::Builder::default()` 之后 `.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| { ... }))`,回调里:
    - 解析 `argv` 找出第一个以 `.md/.markdown/.txt` 结尾且存在的路径;
    - `app.emit("open-file", path)`;
    - 把现有 `main` 窗口 `show()` + `unminimize()` + `set_focus()`。
  - 在 `setup` 里:
    - 删除当前 `std::env::args()` + 500ms sleep 的"猜"事件发送,改为 `app.manage(...)` 暂存启动参数,在前端发出 `frontend-ready` 事件后再统一 `emit("open-file", path)`,避免时序竞态。
    - 增加对 `RunEvent::Opened { urls }` 的处理(macOS 文件双击),转发为 `open-file` 事件。
- `src/App.vue`
  - 新增 `await emit("frontend-ready")`(通过 `@tauri-apps/api/event` 的 `emit`),在 `onMounted` 末尾、监听注册完成后触发。
  - 把现有 `listen("open-file-init", ...)` 改名为 `listen("open-file", ...)`,内部统一调用 `openFile(path)`,且当目标文件已在某个 tab 中打开时,切到该 tab 即可。
  - 增加"运行时通过单实例回调打开第二个文件"的支持。

**自测用例**
- [ ] 应用未启动 → 双击 .md → 应用启动并打开该文件。
- [ ] 应用已启动 → 双击另一个 .md → 当前窗口加载该文件,不出现第二个进程。
- [ ] 双击 .markdown / .txt 同样有效。
- [ ] 路径含中文、含空格 都能正确解析。
- [ ] 单实例回调里调 `set_focus`,Win 10 任务栏图标闪烁并被前置。
- [ ] 卸载应用后,Win 10 资源管理器右键 .md 的"打开方式"中残留项可被清理(NSIS 的 `DeleteRegKey` 处理)。

---

## 三、Typora 功能对比与补齐规划

> 评估原则:对"写作者日常 80% 用得到"的能力,做到体验不弱于 Typora;对"锦上添花"的能力,放到 V1.x 后续迭代。

### 3.1 已有(对齐 Typora)

| 能力 | 现状 | 备注 |
|---|---|---|
| 实时预览 | 三模式(分栏/编辑/预览) | 已有,继续保留 |
| 大纲 / TOC | 侧边栏 | 已有 |
| 任务列表 / 代码高亮 / KaTeX / Mermaid / 脚注 | 插件已集成 | 已有 |
| 文件树 / 多 tab / 最近文件 | 已实现 | 已有 |
| 拖拽图片、搜索替换、自动保存、字数统计 | 已实现 | 已有 |
| 专注 / 打字机模式 | 已实现 | 已有 |
| 导出 HTML / PDF | 已实现 | 已有 |

### 3.2 缺失 / 体验差距(本版本补齐)

| # | 能力 | Typora 体验 | InkStone 现状 | 计划 | 优先级 |
|---|---|---|---|---|---|
| 1 | **图片插入/复制粘贴** | 拖入即上传,粘贴截图自动存到同目录 | 工具栏只能选文件,粘贴未处理 | 增加 `paste` 监听,截屏/剪贴板图片写入 `assets/` 并相对引用;支持拖入多图批量 | P0 |
| 2 | **图片缩放/对齐** | 拖拽角点改尺寸,左/居中/右 | `<img>` 写死 `max-width:100%` | 输出带 `data-` 的可交互 `<img>`,在预览区提供 25%/50%/100%/原图 缩放按钮和左/中/右切换 | P0 |
| 3 | **代码块语言/复制按钮/行号** | 右上角悬浮"复制"按钮、可显示行号 | 已高亮但无复制/行号 | 给 `<pre>` 注入复制按钮;若代码块首行带 `// n=` 或代码语言支持行号则渲染 | P1 |
| 4 | **表格编辑** | 单元格内可点击编辑,自动补齐列 | 只能纯文本写 | 用 `markdown-it` 渲染后,前端把 `<table>` 升级为可编辑网格,blur 后回写 markdown | P1 |
| 5 | **目录自动插入** | 插入 → 目录 | 无 | `[TOC]` 标记或工具栏按钮,在当前位置插入基于 `headings` 的目录 | P1 |
| 6 | **图片管理面板** | 列出本文档所有图片,可批量重命名/移动/删除 | 无 | 侧边栏新模式"资源",展示当前文档引用到的所有图片,支持"在文件夹中显示" | P1 |
| 7 | **主题切换** | 多套主题(GitHub/Night/Newsprint 等) | 只有浅/深 | 至少内置 GitHub / OneDark / Typora-Light / Typora-Dark 四套,持久化 | P1 |
| 8 | **字体/排版设置** | 字体、字号、行宽可调 | 写死 | 偏好设置面板,持久化到 `localStorage` | P2 |
| 9 | **导出更多格式** | DOCX / EPUB / LaTeX | 只有 HTML / PDF | 先补 DOCX(用 `docx` npm 包把 markdown-it 输出转结构化文档) | P2 |
| 10 | **拼写检查** | 内置基础英文 | 无 | 接入 `nspell` 或浏览器原生 spellcheck,中文不处理 | P2 |
| 11 | **字数/阅读时长** | 实时 | 仅字符/词数 | 在状态栏追加"阅读时长 ≈ X 分钟"(按 300 字/分估算) | P2 |
| 12 | **反谢 HTML** | 默认允许(警告) | `html: true` 已开但前端没有安全提示 | 渲染含 `<script>` / `<iframe>` 时,顶栏给一次性安全提示 | P2 |
| 13 | **多窗口/双开同一文件** | 支持 | 单窗口多 tab | 同文件已开则切 tab 即可,本期不做独立多窗口 | 暂缓 |
| 14 | **命令行打开** | typora file.md | 已有,Win 10 修复后即对齐 | — | 已在 BUG 2 中处理 |

### 3.3 本版本(P0+P1)目标清单

> P2 及以上进 V1.1 候选,本期不做。

**P0(必须进 V1.0.0)**
- [x] BUG 1:图片显示(本地路径 + 相对路径 + 网络 + base64 全覆盖) — `tauri.conf.json` 启用 `assetProtocol` + `Cargo.toml` 加 `protocol-asset` feature,`App.vue` 引入 `convertFileSrc` 在 `md.render` 之前重写本地 `src`
- [x] BUG 2:Win 10 双击 .md 加载(单实例 + argv 解析 + 事件规范化) — `lib.rs` 接 `tauri-plugin-single-instance`、`tauri-plugin-deep-link`;前端用 `frontend-ready` 握手 + `open-file` 事件,改 `installMode: perMachine`
- [x] #1 粘贴图片自动保存 + 多图拖拽 — `handlePaste` 监听 textarea,图片字节写入 `<file>/assets/paste-<ts>-<rand>.<ext>`,插入相对引用
- [x] #2 图片缩放/对齐(至少 4 档缩放 + 左/中/右) — `wrapImagesForInteraction` + 工具栏(25/50/75/100 + 左/中/右)+ 事件委托

**P1(尽量进 V1.0.0)**
- [x] #3 代码块复制按钮(行号留给 V1.1)
- [x] #4 表格可视化编辑(简化版:contenteditable + +/- 行/列 + 复制为 Markdown,未回写源 md)
- [x] #5 目录插入 — `[[toc]]` 占位 + 工具栏按钮 + 锚点跳转
- [x] #6 资源管理面板 — sidebar 新模式,扫描当前文档图片,支持"在文件夹中显示 / 复制路径 / 复制引用 / 移除引用",后端 `reveal_in_folder`(explorer /select、open -R、xdg-open)
- [x] #7 内置多套主题 — `inkstone` / `github` / `onedark` / `typora`,`<html data-theme>` 切换,onedark 强制 dark

**测试/质量门**
- [ ] 关键流程录屏:打开→编辑→插入图片→保存→导出 PDF→关闭→重开
- [ ] Win 10 + Win 11 双机自测通过
- [x] `npm run build`(vue-tsc + vite)零错误
- [x] `cargo check` 零错误
- [ ] `npm run tauri build` 真机打 NSIS 包并自测
- [ ] README 同步更新(快捷键、文件关联安装说明)

## 四、建议的代码改动落点(便于后续直接派活)

| 模块 | 文件 | 关键改动 |
|---|---|---|
| Tauri 配置 | `src-tauri/tauri.conf.json` | `assetProtocol`、`fileAssociations`、`installMode`、`plugins` |
| Tauri 能力 | `src-tauri/capabilities/default.json` | 增 `deep-link:default`、校正 `fs` scope |
| Rust 入口 | `src-tauri/src/lib.rs` | 单实例插件、RunEvent::Opened、清理旧 500ms 事件 |
| Rust 依赖 | `src-tauri/Cargo.toml` | 加 `single-instance`、`deep-link` |
| 前端主组件 | `src/App.vue` | `convertFileSrc`、粘贴图片处理、图片缩放/对齐、代码块按钮、表格编辑、TOC、主题、粘贴监听 |
| 新增组件 | `src/components/ImageAction.vue` 等 | 视实现复杂度拆分(本版本允许先全在 `App.vue` 内) |
| 文档 | `README.md` / `README_EN.md` | 更新快捷键、文件关联说明、Win 10 注意事项 |
| 元数据 | `package.json` / `Cargo.toml` / `tauri.conf.json` | `version: 1.0.0` 同步三处 |

## 五、发布流程 Checklist

- [ ] 所有 P0 完成并通过自测
- [ ] P1 项按完成度更新本文件勾选状态
- [ ] `npm version 1.0.0`(同步三处 version)
- [ ] `npm run tauri build` 在 Win 10 / Win 11 各跑一次
- [ ] 安装包双击 → 装好 → 双击示例 .md 验证文件关联
- [ ] 卸载 → 确认 .md 右键"打开方式"残留被清理
- [ ] 打 tag:`git tag -a v1.0.0 -m "InkStone MD 1.0.0"` 并推 `origin`
- [ ] Release Notes 同步附在本目录
