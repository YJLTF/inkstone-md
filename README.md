# InkStone MD

[English](./README_EN.md) | 中文

一个轻量、优雅的桌面 Markdown 编辑器，基于 Tauri 2 + Vue 3 构建，支持实时预览、所见即所得、代码高亮、数学公式、Mermaid 图表、多套主题、文件关联等开箱即用的能力。

![preview](docs/preview.png)

## 特性

### 内容创作

- **多模式实时预览**:分栏 / 纯编辑 / 纯预览
- **代码块**:highlight.js 100+ 语言高亮 + 行号显示 + 一键复制到剪贴板
- **数学公式**:KaTeX 渲染(行内 `$...$` 与块级 `$$...$$`)
- **Mermaid 图表**:流程图、时序图、甘特图、类图、状态图等
- **任务列表、脚注**:`- [x] 任务` 与 `[^1]` 标准语法
- **搜索替换**:`Ctrl+F`,支持正则转义、上一条/下一条、替换/全部替换
- **自动配对**:输入 `(`/`[`/`{`/`"` 等自动补全另一半
- **粘贴图片**:剪贴板截图自动落盘到 `<file>/assets/`,以相对引用插入
- **图片交互**:预览区 hover 浮出工具栏,支持 25% / 50% / 75% / 100% 缩放 + 左/中/右对齐
- **表格可视化编辑**:点击 `✏️ 编辑` 切换可编辑模式,± 行 / ± 列,`💾 保存到源` 一键写回原 markdown
- **目录插入**:在任意位置写 `[[toc]]` 自动展开为基于标题的多级目录,点击跳转

### 视图与导航

- **大纲 / TOC 侧边栏**:点击同步跳转编辑器 + 预览区,当前标题高亮跟随滚动
- **编辑/预览滚动同步**:分栏模式下双向滚动比例同步,状态栏开关 + `F7` 快捷键切换,默认开启
- **文件树侧边栏**:打开文件夹,右键新建 / 重命名 / 删除
- **资源管理面板**:自动扫描当前文档引用的所有图片,支持
  - 📂 在文件夹中显示(explorer / Finder / xdg-open)
  - ✏️ 重命名 / 📁 移动 / 🗜️ 一键压缩(jpeg / png)
  - 📋 复制绝对路径 / 🔗 复制 Markdown 引用
  - ✕ 移除文档中的引用
- **最近文件**:自动记录最近打开的 10 个文件

### 文件与协作

- **Windows 文件关联**:双击 `.md` / `.markdown` / `.txt` 直接在 InkStone MD 中打开
- **单实例**:已在运行时再次双击文件,不会拉新进程,直接在前台窗口加载
- **命令行打开**:`inkstone-md xxx.md`
- **拖拽打开**:把文件拖到窗口即可打开
- **30 秒自动保存**:避免误关丢失
- **导出 HTML**:**单文件全内联**(KaTeX CSS + highlight.js 主题 + Mermaid JS + 当前主题 + 图片 base64),离线双击即可正常显示
- **导出 PDF**:走 WebView 系统打印 + `Microsoft Print to PDF`,文字可选可搜索、体积小、样式 = 预览所见即所得

### 主题与个性化

- **4 套内置主题**:`InkStone` / `GitHub` / `One Dark` / `Typora`
- **深色 / 浅色双模式**(One Dark 强制深色)
- 主题与模式均持久化到 `localStorage`
- 工具栏下拉切换,即时预览

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+N` | 新建文件 |
| `Ctrl+O` | 打开文件 |
| `Ctrl+S` | 保存文件 |
| `Ctrl+Shift+S` | 另存为 |
| `Ctrl+B` | 切换侧边栏 |
| `Ctrl+F` | 搜索替换 |
| `Ctrl+\` | 循环切换 编辑 / 分栏 / 预览 视图 |
| `F1` | 快捷键说明 |
| `F7` | 切换滚动同步 |
| `Esc` | 关闭搜索面板 / 对话框 |

## 安装

### 从源码构建

```bash
# 1. 安装依赖
npm install

# 2. 开发(Vite 热重载,无 Tauri 窗口)
npm run dev

# 3. Tauri 开发模式(前端 + Rust 后端)
npm run tauri dev

# 4. 构建
npm run build              # vue-tsc 类型检查 + Vite 打包
npm run tauri build        # 打包出 NSIS 安装包(.exe)
```

### 安装包

`npm run tauri build` 完成后,安装包位于:

```
src-tauri/target/release/bundle/nsis/InkStone MD_1.3.0_x64-setup.exe
```

双击安装即可,Windows 会自动注册 `.md` / `.markdown` / `.txt` 文件关联。

### 卸载

通过"控制面板 → 添加或删除程序"卸载。卸载脚本会清理文件关联注册表项,不会留下"打开方式"残留。

## 使用

### 打开文件夹

`Ctrl+O` 打开文件,或工具栏 `📁 文件夹` 打开整个工作区,左侧出现文件树;右键可新建 / 重命名 / 删除。

### 切换主题

工具栏中部下拉选择 `InkStone` / `GitHub` / `One Dark` / `Typora`,右侧 `🌙` / `☀️` 切换深浅色(One Dark 强制深色,选择时会自动切换)。

### 资源管理

打开侧边栏第二个标签 `🖼️ 资源`,即可看到当前文档中所有引用的图片。每个条目支持 `在文件夹中显示 / 重命名 / 移动 / 压缩 / 复制路径 / 复制引用 / 移除引用`。

### 导出

- **HTML**:工具栏 `📤 HTML` 按钮,弹出保存对话框,生成的 `.html` 包含完整样式 + 主题 + 所有图片(base64) + Mermaid/KaTeX 依赖,完全离线可用
- **PDF**:工具栏 `📄 PDF` 按钮,自动切到预览模式后调用系统打印对话框。在打印机下拉里选 `Microsoft Print to PDF`(Win10/11 自带)即可另存为 PDF。首次使用会弹一次性提示

### 表格编辑

在任意 markdown 表格上,顶部出现工具栏:
- `✏️ 编辑`:切换 td/th 为 contenteditable,直接点击修改
- `+ 行 / - 行 / + 列 / - 列`:结构变更
- `💾 保存到源`:把当前 DOM 表格写回原 markdown(精确按原段匹配,光标不丢)
- `复制为 Markdown`:把表格转 markdown 字符串,写入剪贴板

### 代码块

` ```rust ` 等三反引号包起的代码块,预览区会显示:
- 顶部工具栏:语言徽标 + 复制按钮
- 左侧:行号(等宽对齐,折叠/选中不影响)
- 复制拿到的纯文本不含行号前缀

### 目录

在任意位置写:

```markdown
[[toc]]
```

会展开为基于当前文档所有 `# / ## / ###` 标题的多级目录,点击跳转。

## 技术栈

- **前端**:Vue 3 + TypeScript + Vite + TailwindCSS
- **后端**:Tauri 2.x(Rust)
- **Markdown 解析**:markdown-it + markdown-it-task-lists + markdown-it-footnote
- **代码高亮**:highlight.js
- **数学公式**:KaTeX
- **图表**:mermaid
- **UI 图标**:`@lucide/vue`(纯 SVG,随主题变色)
- **图片处理**(压缩):`image` crate(jpeg / png)

## 项目结构

```
inkstone-md/
├── src/                       # Vue 前端源码
│   ├── App.vue                # 主组件(编辑器、文件树、工具栏、状态栏)
│   ├── main.ts                # Vue 入口
│   └── style.css              # 全局样式 + 4 套主题
├── src-tauri/                 # Tauri 后端
│   ├── src/
│   │   ├── lib.rs             # Rust 库入口(命令、单实例、文件打开)
│   │   └── main.rs            # Rust 二进制入口
│   ├── capabilities/
│   │   └── default.json       # Tauri 权限清单
│   ├── icons/                 # 应用图标
│   ├── Cargo.toml             # Rust 依赖
│   └── tauri.conf.json        # Tauri 配置(窗口、bundle、文件关联)
├── ROADMAP_V1.0.0.md          # V1.0.0 发布规划与 P0/P1 验收清单
├── package.json               # Node 依赖与脚本
├── vite.config.ts             # Vite 配置
├── tailwind.config.js         # TailwindCSS 配置
└── tsconfig.json              # TypeScript 配置
```

### Rust 命令(通过 `invoke` 调用)

| 命令 | 用途 |
|------|------|
| `read_file` / `write_file` | 文本文件读写 |
| `read_file_bytes` / `write_file_bytes` | 二进制文件读写(图片复制等) |
| `get_file_info` | 文件元信息(大小等) |
| `read_directory` | 递归读取目录(忽略 `.` 开头) |
| `create_file` / `create_directory` | 创建 |
| `rename_path` / `delete_path` | 重命名 / 删除 |
| `reveal_in_folder` | 在系统文件管理器中显示(explorer / open -R / xdg-open) |
| `compress_image` | 图片重新编码为 jpeg / png,返回压缩后字节数 |
| `frontend_ready` | 前端握手,触发启动挂起文件的派发 |

## 版本记录

### [1.4.0] - 架构治理与 PDF 导出修复

聚焦两大任务:修复 PDF 导出顽疾 + 拆分 App.vue 组件化。详见 [ROADMAP_V1.4.0.md](./ROADMAP_V1.4.0.md)。

#### 🐛 修复
- **PDF 导出彻底重做**:改用隐藏 iframe 打印方案,彻底解决三个顽疾:
  - 状态栏/工具栏/侧边栏不再泄漏到 PDF(iframe 内仅含文档正文)
  - 超长文档不再被裁切(iframe 自然流式排版,完整分页)
  - 页眉不再显示 "InkStone MD"(iframe 文档 title 为空)
- 更新打印提示文案,引导用户关闭页眉页脚获得纯净 PDF

#### 🏗️ 重构
- **App.vue 组件化拆分**:4400 行 → ~3000 行,新增 `src/components/` 与 `src/types/`、`src/utils.ts`、`src/constants/` 目录
  - 提取 8 个 SFC 组件:`TheToolbar`、`TheTabBar`、`EditorPane`、`SearchPanel`、`TheStatusBar`、`ShortcutsModal`、`AboutModal`、`PrintHint`
  - 提取类型声明到 `types/index.ts`、纯工具函数到 `utils.ts`、导出 CSS 常量到 `constants/exportCss.ts`
  - 共享 modal 样式移入全局 `style.css`,`:deep` 富内容样式随 `EditorPane` 组件迁移
- 三处 version 同步到 `1.4.0`

### [1.3.0] - 功能补全与体验修复

聚焦用户反馈的三个问题:补齐纯编辑模式、原生菜单栏增加快捷键与关于。详见 [ROADMAP_V1.3.0.md](./ROADMAP_V1.3.0.md)。

#### ✨ 新增
- **纯编辑模式**:工具栏(铅笔图标)、原生菜单"视图 → 编辑模式"、`Ctrl+\` 循环切换 编辑 / 分栏 / 预览 三种视图;视图模式持久化,重启恢复
- **原生菜单"帮助"子菜单**:`快捷键(F1)` 弹出分组快捷键对话框,`关于 InkStone MD` 弹出版本 / 技术栈 / 许可证信息
- `F1` 快捷键直接打开快捷键对话框;关于对话框版本号经 Vite `define` 从 `package.json` 注入,避免多处手改
- 快捷键清单抽为 `SHORTCUTS` 单一数据源常量

#### 🔧 改进
- 视图模式由双布尔 ref 重构为单一 `viewMode` 枚举(edit/split/preview),`showSplit`/`showPreview` 改为 `computed` 派生,根除非法组合态
- 三处 version 同步到 `1.3.0`
- 打印样式隐藏 modal 遮罩,避免打印时对话框干扰
- 移除体验不佳的专注模式 (F8) 与打字机模式 (F9)

### [1.2.0] - 体验优化版

专注于渲染观感与阅读体验的优化版本,详见 [ROADMAP_V1.2.0.md](./ROADMAP_V1.2.0.md)。

#### 🎨 Markdown 渲染样式全面美化
- **标题层级优化**:统一字号梯度(h1 2.25em → h6 0.9em),h1/h2 加主题色底部边框,增加段前后间距
- **段落与正文**:行高 1.75,段间距 0.9em,长文阅读更舒适
- **列表样式美化**:无序列表改圆点标记(主题色),有序列表数字右对齐,嵌套缩进统一,任务列表复选框样式重绘
- **代码块与行内代码**:代码块加圆角 + 浅边框 + 语言徽标背景,行号区视觉分离;行内代码加背景 + 边框 + 等宽字体
- **引用块设计**:左侧 4px 主题色竖条 + 浅背景 + 斜体,多层嵌套递进加深
- **表格样式**:斑马纹 + 表头背景 + 边框圆角,hover 行高亮
- **链接样式**:下划线 + 主题色,hover 加深
- **水平分割线**:渐变样式,上下留白充足
- **图片样式**:圆角 + 阴影,max-width 100%
- **四套主题差异化**:InkStone / GitHub / One Dark / Typora 各自调整配色与细节

#### 📑 大纲 / 目录点击同步滚动定位
- 预览区 heading 自动生成 id 锚点
- **大纲点击双向同步**:同时定位编辑器光标 + 预览区滚动到对应标题,2s 高亮闪烁提示
- **滚动跟随高亮**:预览区滚动时,大纲侧栏自动高亮当前可视区域的标题
- `[[toc]]` 目录点击同样支持预览区定位

#### 🔄 编辑与预览视图滚动同步
- **比例同步策略**:基于滚动高度比例双向同步,防抖 + 方向锁防止循环抖动
- **默认开启**:分栏模式下自动生效,状态栏可直观看到开关状态
- **F7 快捷键**:一键切换滚动同步状态
- 纯编辑 / 纯预览模式下自动停用

#### 🔧 改进
- 三处 version 同步到 `1.2.0`
- 导出 HTML 的 `EXPORT_BASE_CSS` 同步新版样式,导出与预览观感一致

### [1.1.0] - 优化型迭代

纯优化版本,不引入破坏性改动。集中打磨 UI/工具栏观感与 HTML/PDF 导出保真度,详见 [ROADMAP_V1.1.0.md](./ROADMAP_V1.1.0.md)。

#### 🎨 UI / 工具栏
- **工具栏全面图标化**:从 emoji + 中文升级为 Lucide SVG 图标(`FilePlus` / `FolderOpen` / `Save` / `Bold` / `Italic` / `Heading1` …),统一尺寸,随主题变色
- 工具栏按钮四态完整:default / hover / active(分栏/预览模式高亮)/ disabled / focus-visible outline;`:active` 加 `scale(0.96)` 微动画
- 分组改用间距 + 弱化分隔线,降低视觉噪声;Logo 改纯文字 + 羽毛笔图标
- **响应式溢出**:窗口宽度 < 1080px 时折叠「列表」组,< 820px 时再折叠「插入」组,统一进 `⋯` 下拉菜单(分组标题 + 完整工具)
- **Tab 栏升级**:激活 tab 加 2px 主题色底部高亮 + 微阴影;hover 才显示关闭按钮;未保存指示用 6px 圆点替代 `●` 字符;支持中键关闭
- 全局颜色过渡 200ms(主题/暗色切换不抖);自定义 8px 圆角滚动条

#### 📤 导出
- **HTML 导出 → 单文件全内联**:CSS(KaTeX + highlight.js 主题 + 当前主题)/ Mermaid JS / 图片(base64)全部内联到一个 `.html`,完全离线双击可正常显示
- HTML 导出走 `captureCurrentTheme` 主题快照,保证所见即所得(亮/暗、4 套主题全部生效)
- **PDF 导出 → WebView 打印 + Save as PDF**:`window.print()` 调起系统打印对话框,选 `Microsoft Print to PDF` 即可保存为 PDF;输出文字可选可搜索、体积小、样式 = 预览
- 完整 `@media print` 样式:隐藏工具栏 / Tab / 侧边栏 / 状态栏,只打印预览内容;`@page A4 / margin 15mm`;标题/代码块/表格/图片防分页切断;`print-color-adjust: exact` 保留代码块背景
- 首次点 PDF 弹一次性提示横幅,告诉用户选哪个打印机;写入 `localStorage` 不再弹
- 移除 `jspdf` + `html2canvas` 依赖(bundle 体积 -~600KB)

#### 🔧 改进
- 三处 version 同步到 `1.1.0`
- `package.json` 新增依赖:`@lucide/vue`
- 导出渲染走与预览完全相同的 markdown 流水线(图片 base64 内联 + TOC 预处理 + KaTeX + Mermaid 占位),保证 WYSIWYG

#### ⚠️ 已知边界
- HTML 导出含大量图片时文件较大(每张图 base64 ≈ 原图 1.3 倍),典型文档 < 5MB
- KaTeX 数学字符在没有 KaTeX 字体文件的导出 HTML 里降级为系统衬线字体,常见数学符号正常,极少冷僻字符会显示为方框
- 导出 PDF 需用户在系统打印对话框里手动选 `Microsoft Print to PDF` 一步操作(无法 100% 自动化)

### [1.0.0] - 首发正式版

以"可日常使用"为门槛,集中解决两个阻塞性 BUG,并补齐 Typora 同类核心体验。

#### 🐛 修复
- **图片无法显示**:WebView 默认拒绝 `file://` 协议,启用 `assetProtocol` + `convertFileSrc`,本地绝对路径 / 相对路径 / 网络 URL / base64 全覆盖
- **Win 10 双击 .md 文件无法加载**:缺单实例 + 时序竞态,改用 `tauri-plugin-single-instance` + `tauri-plugin-deep-link`,前端 `frontend-ready` 握手,统一 `open-file` 事件;NSIS `installMode: perMachine` 让文件关联全局生效

#### ✨ 新增
- 代码块行号(每行 `<div class="line">`,复制不影响)
- 代码块一键复制
- 表格可视化编辑:✏️ 编辑 / ± 行 / ± 列 / 💾 保存到源 / 复制为 Markdown
- 目录插入:`[[toc]]` 占位符 + 工具栏按钮 + 锚点跳转
- 资源管理面板:在文件夹中显示 / 重命名 / 移动 / 压缩 / 复制路径 / 复制引用 / 移除引用
- 4 套内置主题:`InkStone` / `GitHub` / `One Dark` / `Typora`
- 粘贴图片自动落盘到 `<file>/assets/`
- 图片缩放 4 档(25 / 50 / 75 / 100%)与对齐 3 档(左 / 中 / 右)
- 单实例:已在运行时双击文件聚焦现有窗口

#### 🔧 改进
- `fileAssociations` 扩展为 `.md` / `.markdown` / `.txt`
- Tauri 启用 `protocol-asset` feature;`Cargo.lock` 同步更新
- `Cargo.toml` 新增依赖:`tauri-plugin-single-instance` / `tauri-plugin-deep-link` / `image`
- 启动参数解析:健壮处理路径含空格 / 引号 / 中文

#### ⚠️ 已知边界
- 资源压缩走 Rust `image` 0.25(纯 Rust,无需外部工具);不支持 webp / avif(后续可加)
- 资源重命名 / 移动 / 压缩弹窗用浏览器原生 `prompt` / `confirm`,后续可替换为自定义 modal
- 主题字体用系统字体,未打包自定义字体文件

### [0.1.2] - 早期开发版

历史版本。实现了多标签页、文件树、搜索替换、KaTeX、Mermaid、自动保存、最近文件、HTML / PDF 导出等基础能力,但图片显示与 Win 10 文件关联存在已知 BUG。

## 路线图

V1.x 候选特性见 [ROADMAP_V1.0.0.md](./ROADMAP_V1.0.0.md)(含 DOCX 导出、拼写检查、字体偏好等)、[ROADMAP_V1.1.0.md](./ROADMAP_V1.1.0.md)、[ROADMAP_V1.2.0.md](./ROADMAP_V1.2.0.md) 与 [ROADMAP_V1.3.0.md](./ROADMAP_V1.3.0.md)(各期优化的详细记录与剩余工作项)。

## 贡献

欢迎提交 Issue 与 Pull Request。开发前请先 `npm install` 并确保 `npm run build` 与 `cargo check` 均无错误。

## 许可证

GPL-3.0 License
