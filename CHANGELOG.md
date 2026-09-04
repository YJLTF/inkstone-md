# 更新日志(Changelog)

记录 InkStone MD 每个版本的用户可感知变更。各版本的规划、验收清单与遗留工作项见 [docs/roadmaps/](./docs/roadmaps/)。

## [1.6.0] - 预览全面增强美化

对预览页做一次全面增强:样式基建(CSS 变量化 + 预览/导出单源化)、四项语法扩展、全元素视觉精修、阅读偏好设置面板、图片灯箱与阅读进度条。详见 [ROADMAP_V1.6.0.md](./docs/roadmaps/ROADMAP_V1.6.0.md)。

### ✨ 新增
- **语法扩展**:
  - GitHub 提示块:`> [!NOTE] / [!TIP] / [!IMPORTANT] / [!WARNING] / [!CAUTION]` 渲染为带图标彩色提示卡,亮暗主题各一版配色
  - 行内三件套:`==高亮标记==`、`^上标^`、`~下标~`
  - Front-matter 元信息卡:文件头 YAML 渲染为文档顶部元信息卡(标题强调 + 标签 chips + 键值行)
  - 音视频嵌入:`![](demo.mp4)` / `![](bgm.mp3)` 内联渲染为原生播放器
- **阅读偏好设置面板**(`Ctrl+,` / 工具栏齿轮 / 原生菜单):正文字体、字号五档、内容行宽三档、代码高亮主题 8 选 1;即换即生效、持久化保留,导出 HTML/PDF 同步使用
- **图片灯箱**:点击预览图片全屏查看,滚轮/按钮缩放(20%–500%),Esc / 点击遮罩关闭
- **标题锚点**:hover 标题浮现 `#`,点击复制 `#slug` 锚点链接
- **图注**:语法 `![alt](src "title")` 的 title 渲染为图片下方图注
- **阅读进度条**:预览面板顶部跟随滚动的细进度条
- 补齐 `kbd` 键帽、`details/summary` 折叠块、脚注回链等元素样式

### 🎨 视觉美化
- 标题层级精修:h1 改主题强调色短下划线,h2 细分隔线,层级字号统一节奏
- 引用块 / 表格 / 图片圆角与阴影统一精修,全部跟随主题强调色
- 代码块容器升级:圆角 10px + 语言徽标 + 顶栏一体化,行号栏视觉分离
- 四套主题(InkStone / GitHub / One Dark / Typora)统一受益于新变量体系

### 🏗️ 重构
- **预览样式 CSS 变量化**:全部颜色抽为 `--ink-md-*` 变量,`:root` 浅色基线 + `.dark` 暗色基线 + 各主题只覆写变量值
- **预览/导出样式单源化**:新建 `src/assets/markdown-body.css` 作为唯一真源,导出以 `?raw` 内联,删除 `EXPORT_BASE_CSS` 手工副本,不再漂移
- **hljs 按需加载**:全量导入改 `highlight.js/lib/common`(常用语言),预览代码高亮主题动态注入、亮暗自适应,修复亮色模式代码 token 暗色配色错配
- 预览交互元素样式(`ink-codeblock` / `ink-table` / 图片工具栏 / TOC)从 EditorPane `:deep` 迁入全局并变量化(顺带修复 `.dark :deep()` 选择器永不匹配导致暗色变体失效的问题)
- 输入防抖渲染:击键 250ms 内合并全量重渲染(切换 tab 立即同步),长文档打字更流畅
- 卸载死依赖 `html2canvas` / `jspdf`
- 三处 version 同步到 `1.6.0`

### 🐛 修复
- **导出物 TOC / 锚点全部失效**:导出渲染管线补调 `addHeadingIds`,导出 HTML/PDF 中目录与锚点链接恢复跳转
- **分栏滚动同步抖动**:同步锁的解锁定时器每次新起未取消,连续滚动时提前解锁造成双向回写;改为全局唯一可重置定时器
- **阅读进度条遮挡正文**:由滚动容器内 sticky 悬浮改为预览面板顶部独立布局条,内容零遮挡
- **"选中 N 字"统计错位**:WebView2 中 textarea 选区不触发 document 级 `selectionchange`,旧实现只统计到编辑器外的选区(如标签栏文字);改挂 textarea 元素级事件,编辑器内精确计数、外部选区一律不计
- **资源面板误识别**:扫描前跳过 fenced/行内代码段,文档里反引号包裹的 `![](demo.mp4)` 等语法示例不再被当作真实资源引用
- **资源面板"显示"按钮对含空格路径失败**:`reveal_in_folder` 改用 `raw_arg` 精确控制 explorer 引号(如 `F:\InkStone MD\` 这类带空格的项目路径)

### ⚡ 性能与代码质量
- **渲染管线单源化**:预览与导出的 mermaid/KaTeX/锚点/媒体后处理合并为 `utils/markdown.ts` 的同一条 `renderMarkdownHTML` 管线,删除两份漂移副本;导出主题色改 `getComputedStyle` 读实时值,删除手抄色表
- **导出/打印抽离 `useExport.ts`**,两处重复的 HTML head + mermaid 初始化脚本合并;快捷键清单内聚进 `ShortcutsModal`
- **性能**:大纲/词数改读 250ms 防抖副本(不再每次击键全量扫描)、搜索防抖、mermaid 按「主题+源码」增量渲染跳过未变更图
- 清理死代码:AppConfig 类型、useWorkspace 12 个无消费导出、`PRINT_CSS` 旧结构选择器、失效 favicon、永不匹配的 scoped katex/滚动条样式(`katex-error` 样式顺势补进 markdown-body.css,此前公式报错实际无样式)
- App.vue 3127 → 2145 行

## [1.5.0] - 双区文件树重构

重构侧边栏文件树为双区模型,新增文件/文件夹移动、应用内库、外部文件夹持久化等。详见 [ROADMAP_V1.5.0.md](./docs/roadmaps/ROADMAP_V1.5.0.md)。

### ✨ 新增
- **双区文件树**:
  - 📚 **我的库**:应用内工作区,首次启动自动在 app data 目录建默认库根,支持文件/文件夹完整 新建/重命名/删除/移动,可一键「迁移库」到自选目录(含已开文档路径重映射)
  - 📁 **外部文件夹**:打开系统任意目录,只读目录结构、仅可操作文件(不可新建/重命名/删除/移动文件夹)
  - **拖拽移动**:树内拖拽文件/文件夹到任意目录(含根),支持跨盘符(copy+delete 回退)、跨库/外部,防拖入自身子树;另提供右键「移动到…」
  - **持久化与恢复**:外部文件夹最近列表存 `tauri-plugin-store`,重启自动恢复;路径失效标灰可一键移除
- **树状视图**:展开/收起箭头(▾/▸)+ 层级竖线引导,每级(含库根/外部根)可折叠;库根(蓝色系)与外部根(琥珀色系)视觉明显区分
- 新增 Rust 命令:`ensure_library` / `migrate_library` / `move_path`(跨盘符安全移动)
- 新增依赖:`tauri-plugin-store`(配置持久化)、前端 `@tauri-apps/plugin-store`

### 🏗️ 重构
- **文件树逻辑抽离**:从 App.vue 抽出 `useWorkspace.ts` composable(多根模型 + CRUD + 移动 + 拖拽 + 持久化 + 库迁移)与 `TheFileTree.vue` + 递归 `TreeNode.vue` 组件,替换原 `h()` 手写递归;App.vue 减约 430 行
- **增量更新**:文件树 CRUD/移动改为局部节点增删改,不再整根重读目录
- 三处 version 同步到 `1.5.0`

### 🐛 修复
- **代码块内容被二次渲染**:`highlight` 无语言分支未转义(代码块内 `<tag>`/HTML 实体被当 HTML 渲染)+ katex/TOC/图片预处理正则穿透 `<code>` 内部;新增 `mapOutsideCode` 让预处理跳过代码块,katex 替换前暂存代码块、替换后还原
- **`reveal_in_folder` 对目录用 `/select` 导致打开父目录**:目录改为直接打开其内容(文件仍 `/select` 定位),Win/macOS/Linux 三分支统一
- **新建落到根目录**:右键文件夹时 parentPath 现正确指向文件夹内部
- **PDF 公式被当代码块**:导出管线与预览对齐(mermaid 前置 + 代码块保护 + katex)
- **PDF 默认文件名空白**:打印前临时切换主窗口 `document.title` 为文档名;PrintHint 引导选「另存为 PDF」(文件名自动取文档名)
- **PDF 说明反复弹出**:改为首次点导出才弹一次,确认后打印并标记
- **外部文件夹关闭后重启又出现**:✕ 关闭改为同时移除最近记录

## [1.4.0] - 架构治理与 PDF 导出修复

聚焦两大任务:修复 PDF 导出顽疾 + 拆分 App.vue 组件化。详见 [ROADMAP_V1.4.0.md](./docs/roadmaps/ROADMAP_V1.4.0.md)。

### 🐛 修复
- **PDF 导出彻底重做**:改用隐藏 iframe 打印方案,彻底解决三个顽疾:
  - 状态栏/工具栏/侧边栏不再泄漏到 PDF(iframe 内仅含文档正文)
  - 超长文档不再被裁切(iframe 自然流式排版,完整分页)
  - 页眉不再显示 "InkStone MD"(iframe 文档 title 为空)
- 更新打印提示文案,引导用户关闭页眉页脚获得纯净 PDF

### 🏗️ 重构
- **App.vue 组件化拆分**:4400 行 → ~3000 行,新增 `src/components/` 与 `src/types/`、`src/utils.ts`、`src/constants/` 目录
  - 提取 8 个 SFC 组件:`TheToolbar`、`TheTabBar`、`EditorPane`、`SearchPanel`、`TheStatusBar`、`ShortcutsModal`、`AboutModal`、`PrintHint`
  - 提取类型声明到 `types/index.ts`、纯工具函数到 `utils.ts`、导出 CSS 常量到 `constants/exportCss.ts`
  - 共享 modal 样式移入全局 `style.css`,`:deep` 富内容样式随 `EditorPane` 组件迁移
- 三处 version 同步到 `1.4.0`

## [1.3.0] - 功能补全与体验修复

聚焦用户反馈的三个问题:补齐纯编辑模式、原生菜单栏增加快捷键与关于。详见 [ROADMAP_V1.3.0.md](./docs/roadmaps/ROADMAP_V1.3.0.md)。

### ✨ 新增
- **纯编辑模式**:工具栏(铅笔图标)、原生菜单"视图 → 编辑模式"、`Ctrl+\` 循环切换 编辑 / 分栏 / 预览 三种视图;视图模式持久化,重启恢复
- **原生菜单"帮助"子菜单**:`快捷键(F1)` 弹出分组快捷键对话框,`关于 InkStone MD` 弹出版本 / 技术栈 / 许可证信息
- `F1` 快捷键直接打开快捷键对话框;关于对话框版本号经 Vite `define` 从 `package.json` 注入,避免多处手改
- 快捷键清单抽为 `SHORTCUTS` 单一数据源常量

### 🔧 改进
- 视图模式由双布尔 ref 重构为单一 `viewMode` 枚举(edit/split/preview),`showSplit`/`showPreview` 改为 `computed` 派生,根除非法组合态
- 三处 version 同步到 `1.3.0`
- 打印样式隐藏 modal 遮罩,避免打印时对话框干扰
- 移除体验不佳的专注模式 (F8) 与打字机模式 (F9)

## [1.2.0] - 体验优化版

专注于渲染观感与阅读体验的优化版本,详见 [ROADMAP_V1.2.0.md](./docs/roadmaps/ROADMAP_V1.2.0.md)。

### 🎨 Markdown 渲染样式全面美化
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

### 📑 大纲 / 目录点击同步滚动定位
- 预览区 heading 自动生成 id 锚点
- **大纲点击双向同步**:同时定位编辑器光标 + 预览区滚动到对应标题,2s 高亮闪烁提示
- **滚动跟随高亮**:预览区滚动时,大纲侧栏自动高亮当前可视区域的标题
- `[[toc]]` 目录点击同样支持预览区定位

### 🔄 编辑与预览视图滚动同步
- **比例同步策略**:基于滚动高度比例双向同步,防抖 + 方向锁防止循环抖动
- **默认开启**:分栏模式下自动生效,状态栏可直观看到开关状态
- **F7 快捷键**:一键切换滚动同步状态
- 纯编辑 / 纯预览模式下自动停用

### 🔧 改进
- 三处 version 同步到 `1.2.0`
- 导出 HTML 的 `EXPORT_BASE_CSS` 同步新版样式,导出与预览观感一致

## [1.1.0] - 优化型迭代

纯优化版本,不引入破坏性改动。集中打磨 UI/工具栏观感与 HTML/PDF 导出保真度,详见 [ROADMAP_V1.1.0.md](./docs/roadmaps/ROADMAP_V1.1.0.md)。

### 🎨 UI / 工具栏
- **工具栏全面图标化**:从 emoji + 中文升级为 Lucide SVG 图标(`FilePlus` / `FolderOpen` / `Save` / `Bold` / `Italic` / `Heading1` …),统一尺寸,随主题变色
- 工具栏按钮四态完整:default / hover / active(分栏/预览模式高亮)/ disabled / focus-visible outline;`:active` 加 `scale(0.96)` 微动画
- 分组改用间距 + 弱化分隔线,降低视觉噪声;Logo 改纯文字 + 羽毛笔图标
- **响应式溢出**:窗口宽度 < 1080px 时折叠「列表」组,< 820px 时再折叠「插入」组,统一进 `⋯` 下拉菜单(分组标题 + 完整工具)
- **Tab 栏升级**:激活 tab 加 2px 主题色底部高亮 + 微阴影;hover 才显示关闭按钮;未保存指示用 6px 圆点替代 `●` 字符;支持中键关闭
- 全局颜色过渡 200ms(主题/暗色切换不抖);自定义 8px 圆角滚动条

### 📤 导出
- **HTML 导出 → 单文件全内联**:CSS(KaTeX + highlight.js 主题 + 当前主题)/ Mermaid JS / 图片(base64)全部内联到一个 `.html`,完全离线双击可正常显示
- HTML 导出走 `captureCurrentTheme` 主题快照,保证所见即所得(亮/暗、4 套主题全部生效)
- **PDF 导出 → WebView 打印 + Save as PDF**:`window.print()` 调起系统打印对话框,选 `Microsoft Print to PDF` 即可保存为 PDF;输出文字可选可搜索、体积小、样式 = 预览
- 完整 `@media print` 样式:隐藏工具栏 / Tab / 侧边栏 / 状态栏,只打印预览内容;`@page A4 / margin 15mm`;标题/代码块/表格/图片防分页切断;`print-color-adjust: exact` 保留代码块背景
- 首次点 PDF 弹一次性提示横幅,告诉用户选哪个打印机;写入 `localStorage` 不再弹
- 移除 `jspdf` + `html2canvas` 依赖(bundle 体积 -~600KB)

### 🔧 改进
- 三处 version 同步到 `1.1.0`
- `package.json` 新增依赖:`@lucide/vue`
- 导出渲染走与预览完全相同的 markdown 流水线(图片 base64 内联 + TOC 预处理 + KaTeX + Mermaid 占位),保证 WYSIWYG

### ⚠️ 已知边界
- HTML 导出含大量图片时文件较大(每张图 base64 ≈ 原图 1.3 倍),典型文档 < 5MB
- KaTeX 数学字符在没有 KaTeX 字体文件的导出 HTML 里降级为系统衬线字体,常见数学符号正常,极少冷僻字符会显示为方框
- 导出 PDF 需用户在系统打印对话框里手动选 `Microsoft Print to PDF` 一步操作(无法 100% 自动化)

## [1.0.0] - 首发正式版

以"可日常使用"为门槛,集中解决两个阻塞性 BUG,并补齐 Typora 同类核心体验。

### 🐛 修复
- **图片无法显示**:WebView 默认拒绝 `file://` 协议,启用 `assetProtocol` + `convertFileSrc`,本地绝对路径 / 相对路径 / 网络 URL / base64 全覆盖
- **Win 10 双击 .md 文件无法加载**:缺单实例 + 时序竞态,改用 `tauri-plugin-single-instance` + `tauri-plugin-deep-link`,前端 `frontend-ready` 握手,统一 `open-file` 事件;NSIS `installMode: perMachine` 让文件关联全局生效

### ✨ 新增
- 代码块行号(每行 `<div class="line">`,复制不影响)
- 代码块一键复制
- 表格可视化编辑:✏️ 编辑 / ± 行 / ± 列 / 💾 保存到源 / 复制为 Markdown
- 目录插入:`[[toc]]` 占位符 + 工具栏按钮 + 锚点跳转
- 资源管理面板:在文件夹中显示 / 重命名 / 移动 / 压缩 / 复制路径 / 复制引用 / 移除引用
- 4 套内置主题:`InkStone` / `GitHub` / `One Dark` / `Typora`
- 粘贴图片自动落盘到 `<file>/assets/`
- 图片缩放 4 档(25 / 50 / 75 / 100%)与对齐 3 档(左 / 中 / 右)
- 单实例:已在运行时双击文件聚焦现有窗口

### 🔧 改进
- `fileAssociations` 扩展为 `.md` / `.markdown` / `.txt`
- Tauri 启用 `protocol-asset` feature;`Cargo.lock` 同步更新
- `Cargo.toml` 新增依赖:`tauri-plugin-single-instance` / `tauri-plugin-deep-link` / `image`
- 启动参数解析:健壮处理路径含空格 / 引号 / 中文

### ⚠️ 已知边界
- 资源压缩走 Rust `image` 0.25(纯 Rust,无需外部工具);不支持 webp / avif(后续可加)
- 资源重命名 / 移动 / 压缩弹窗用浏览器原生 `prompt` / `confirm`,后续可替换为自定义 modal
- 主题字体用系统字体,未打包自定义字体文件

## [0.1.2] - 早期开发版

历史版本。实现了多标签页、文件树、搜索替换、KaTeX、Mermaid、自动保存、最近文件、HTML / PDF 导出等基础能力,但图片显示与 Win 10 文件关联存在已知 BUG。
