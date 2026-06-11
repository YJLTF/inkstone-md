# InkStone MD V1.1.0 发布规划

> 目标:在 V1.0.0 "可日常使用" 的基础上,做一轮纯优化型迭代。**不引入破坏性改动**,集中打磨两类高频体验——**UI/工具栏观感** 与 **HTML/PDF 导出保真度**。

## 一、版本基线

| 项 | 当前 | 目标 |
|---|---|---|
| `package.json` version | 1.0.0 | 1.1.0 |
| `src-tauri/Cargo.toml` version | 1.0.0 | 1.1.0 |
| `src-tauri/tauri.conf.json` version | 1.0.0 | 1.1.0 |
| 分支 | `release/v1.0.0`(已发布) | `release/v1.1.0`(本期) |
| Tag | `v1.0.0` 已存在 | `v1.1.0`(构建并自测通过后打) |

> 三处 version 必须**同步**改,缺一即 `tauri build` 失败。规则见 `AGENTS.md` "版本号必须三处同步"。

## 二、总体方向

| 主题 | 现状痛点 | V1.1.0 目标 |
|---|---|---|
| **A. UI 美观** | 工具栏用 emoji+中文,样式简陋;Tab 栏/状态栏/侧边栏零散;暗色过渡突兀 | 整体视觉统一,工具栏现代化、可识别,交互细节到位 |
| **B. 导出 HTML** | CDN 外链 KaTeX、依赖网络;无代码高亮主题;无 Mermaid 渲染;本地图片可能失效 | 单文件全内联,完全离线,所见即所得 |
| **B. 导出 PDF** | html2canvas 截图 → 文字不可选、体积大;分页靠手算 | WebView 系统打印 + Save as PDF,文字可选、体积小、所见即所得 |

不做:
- 不引入新功能(如 DOCX/EPUB、拼写检查、表格回写 md),这些仍在 V1.x 后续候选。
- 不拆分 `App.vue` 组件化(沿用 V1.0.0 的"单文件"约定,降低风险)。
- 不改 Tauri 后端命令(Rust 端零改动,本期纯前端优化)。

## 三、阶段 A · UI 美观

### A1. 工具栏重做(优先级最高)

**目标**:从"emoji 文字按钮堆叠"升级为"图标化、分组清晰、有状态反馈"。

**(1) 图标系统**
- 新增依赖 `lucide-vue-next`(轻量、按需 tree-shake、纯 SVG、随主题变色)。
- 每个工具栏按钮改用对应的 Lucide 组件,例如:
  - 文件: `FilePlus` / `FolderOpen` / `Save`
  - 标题: `Heading1` / `Heading2` / `Heading3`
  - 格式: `Bold` / `Italic` / `Strikethrough` / `Code`
  - 列表: `List` / `ListOrdered` / `SquareCheck` / `Quote`
  - 插入: `Image` / `Link` / `Sigma`(公式)/ `Code2`(代码块)/ `Table` / `ListTree`(目录)
  - 导出: `FileCode`(HTML)/ `Printer`(PDF,语义更准)
  - 视图: `Columns2`(分栏)/ `Eye`(预览)
  - 主题: `Sun` / `Moon`
- 保留 `title` 属性作为原生 tooltip(沿用现有行为,零成本)。

**(2) 视觉与状态**
- 重新设计 `.toolbar-btn`:统一尺寸(28×28 或 32×32)、icon-only,hover/active/disabled/focus 四态。
- 引入"激活态"指示:对当前段落对应的标题级别按钮,自动高亮(`Bold`/`Italic` 对选中文字生效时高亮)。
- 主题色适配:用 `currentColor` 让图标随主题文本色,不要写死色。
- 分组分隔线改为"间距 + 弱化背景"而非强 border,降低视觉噪声。
- Logo 区(`📝 InkStone`)改为纯文字 logo + 一个小图标。

**(3) 响应式溢出**
- 工具栏在窗口变窄时,把次要组(列表/插入)折叠进"⋯"溢出菜单。
- 用 `ResizeObserver` 监听宽度,或 CSS container queries(优先 CSS,简单)。
- 优先级:文件 > 标题 > 格式 > 列表 > 插入(导出与视图模式永远保留)。

**(4) 鼠标交互细节**
- 按钮 `:focus-visible` 加 outline,键盘可达。
- `:active` 加 `scale(0.96)` 微动画。
- 主题切换按钮加 200ms 旋转过渡。

### A2. 整体 UI 微调(配合 A1)

| 区域 | 改动 |
|---|---|
| Tab 栏 | 关闭按钮改 Lucide `X`;hover 时背景柔和;激活 tab 加底部 2px 主题色高亮;支持中键关闭 |
| 状态栏 | 左侧字数/光标位置用统一字体;右侧模式指示加图标(`Pencil`/`Eye`/`Columns2`) |
| 侧边栏(文件树 / 大纲 / 资源) | 折叠/展开用 Lucide `ChevronRight`/`ChevronDown` 旋转;文件/文件夹加轮廓图标;hover 高亮更明显 |
| 拖放区 | 空状态插画调整,文字层级更清晰 |
| 暗色切换 | 全局加 `transition: background-color 200ms, color 200ms, border-color 200ms`,避免硬切 |
| 滚动条 | 自定义细滚动条,默认 8px 宽、圆角、hover 加深 |

### A3. 主题过渡
- 切换主题/暗色时,顶部加 200ms 颜色过渡;但**不要**给图片/代码块也加过渡,会有视觉抖动。
- 主题色变量统一收敛到 `App.vue` 顶部的 CSS 变量,后续主题切换只改这些变量。

### A4. 不在本期做
- 工具栏自定义(用户拖拽按钮)
- 浮动工具栏(类似 Typora 选中文字时的气泡菜单)
- 多级菜单(下拉式子菜单)

## 四、阶段 B · 导出优化

### B1. HTML 导出:单文件全内联

**目标**:导出的 `.html` 离线双击即可正常显示,样式与编辑器预览一致,无任何外链。

**(1) 资源清单(全部内联)**

| 资源 | 来源 | 处理方式 |
|---|---|---|
| KaTeX 样式 | 远端 CDN | 第一次使用时 fetch 一次并缓存到内存;导出时取当前主题对应的 CSS 字符串,塞 `<style>` |
| 代码高亮主题 | `highlight.js` 内置 | 取出当前主题对应的 CSS 字符串内联(`github` / `github-dark` / `atom-one-dark` / `default`) |
| Mermaid 库 | `mermaid/dist/mermaid.min.js` | 静态资源,导出时把字符串内联到 `<script>` |
| Mermaid 初始化 | 应用启动时的 init | 在 HTML 头部重新跑一次 `mermaid.initialize` + `mermaid.run` |
| KaTeX 字体 | CDN woff2 | **不进 HTML**(单文件过大且字体已下到本地 OS);改为用系统字体兜底 + KaTeX 数学字符降级,导出时只内联 CSS 不内联字体 |
| 图片(本地) | `<file>` 绝对/相对路径 | 通过 `read_file_bytes` 读取,转 base64,替换原 `src` |
| 图片(URL http/https) | 网络 | `fetch` 后转 base64 内联(失败则保留原 URL 并在导出产物里给提示) |
| 图片(data:) | 已内联 | 原样保留 |

**(2) 主题快照**
- 导出时,把当前 `<html data-theme>` + `isDark` + `themeName` 一并写入导出 HTML,渲染时立即应用,保证颜色一致。
- 不导出主题切换 UI(只导出渲染好的内容)。

**(3) 样式与排版**
- 复用 `App.vue` 中的 `.markdown-body` 完整 CSS(关键是把 1.0.0 里的"PDF 临时样式"沉淀成可复用的常量 `PRINT_BASE_CSS` / `PREVIEW_BASE_CSS`)。
- A4 友好的页边距、`max-width: 800px`、`line-height: 1.7`。
- 给 `<pre>` `<table>` `<blockquote>` `<img>` 提供与预览完全一致的样式,无视觉跳变。
- 加 `@media print` 兜底,让同一文件用浏览器打印时也好看。

**(4) 实现落点**
- `src/App.vue` 中新增 `buildStandaloneHTML(content: string, theme: string): Promise<string>` 纯函数(便于单测,虽然仓库没单测框架)。
- `exportHTML()` 改为:解析当前 markdown → 调用 `buildStandaloneHTML` → `write_file`。
- 暴露一个**进度提示**(顶栏 toast 或状态栏文案),告诉用户"正在打包图片…"因为含大量图片时可能耗时数秒。

### B2. PDF 导出:WebView 打印 + Save as PDF

**目标**:用户点"PDF"按钮 → 弹出系统打印对话框 → 选 "Microsoft Print to PDF" → 保存。输出文字可选可搜索、体积小、样式与预览完全一致。

**(1) 触发方式**
- 点击"PDF"按钮 → 切换为预览模式(若不是)→ 调用 `window.print()`。
- 由于 Tauri 2 的 WebView2(Win10/11 默认)原生支持打印对话框,无需新增依赖。

**(2) `@media print` 样式要点**
- `body *` 全部 `visibility: hidden`,然后 `#print-root *` 单独 `visibility: visible` + 绝对定位铺满页面。这样只打印"渲染好的内容",不打印工具栏/Tab/状态栏。
- 打印根容器 `#print-root` 用 A4 尺寸(`210mm × 297mm`),`@page` 设 `size: A4; margin: 15mm;`。
- 隐藏交互元素(图片缩放工具栏、代码块复制按钮、表格编辑工具栏):`display: none !important`,只保留内容。
- 链接保留文字(默认浏览器会打 URL 后缀,主动用 CSS 关掉):`a::after { content: ''; }`。
- 强制分页:`h1, h2 { page-break-after: avoid; }`、`pre, blockquote, table { page-break-inside: avoid; }`、`img { page-break-inside: avoid; max-width: 100%; }`。
- 颜色:`-webkit-print-color-adjust: exact; print-color-adjust: exact;` 保证代码块背景色保留。

**(3) 打印根容器**
- 准备一个隐藏的 `#print-root` 节点(放在 `App.vue` 根下,平时 `display: none`),内容是当前 `renderedHTML` 的克隆。
- `print()` 前做一次"主题快照"——把当前主题变量写进 `:root` inline style,确保打印期间主题不会因为状态变化跑掉。

**(4) 沿用还是删除 html2canvas 路径?**
- 保留 V1.0.0 的 `exportPDF` 实现但**改名 `exportPDFLegacy` 并标记 deprecated**,藏在"导出 → PDF(图片式)"二级菜单里,作为兜底(适用于一些追求像素一致性的场景)。
- 默认 `exportPDF` 走打印路径。

**(5) 用户提示**
- 第一次点击 PDF,顶栏弹一次性 tooltip:"Win10/11 选 Microsoft Print to PDF 即可保存",1.0.0 的"读图识字"类经验在 README 里也补一段。

### B3. 共用的"主题快照"机制(A1/A2/B1/B2 都依赖)

新增一个 composable 或纯函数 `captureCurrentTheme(): { cssVars: Record<string,string>; themeName: string; isDark: boolean; highlightTheme: string }`,返回:
- 当前主题(inkstone/github/onedark/typora)
- 当前所有 `--*` CSS 变量实际值
- 当前代码高亮主题

供 `buildStandaloneHTML` 和打印时 `@media print` 注入使用,确保三处渲染(预览/HTML 导出/PDF 打印)用同一份"主题状态"。

## 五、关键文件与改动落点

| 文件 | 改动概要 |
|---|---|
| `package.json` | 新增 `lucide-vue-next`;version → 1.1.0 |
| `src-tauri/Cargo.toml` | version → 1.1.0(无新 Rust 依赖) |
| `src-tauri/tauri.conf.json` | version → 1.1.0 |
| `src/App.vue` | 工具栏重写;新增 `buildStandaloneHTML` / `captureCurrentTheme` / `exportPDF` 打印路径;`@media print` 样式;`.toolbar-btn` 重设计;整体 UI 微调 |
| `src/style.css`(如有) | 配合 `App.vue` 改滚动条、过渡等 |
| `README.md` / `README_EN.md` | 特性章节更新;导出方式更新;Win 10 PDF 提示 |

> **不**新增 `src/components/*`(V1.0.0 起约定单文件)。本期允许继续把逻辑塞在 `App.vue` 里,以最小化风险。

## 六、自测用例

### UI
- [ ] 工具栏图标在亮/暗主题下颜色自然,无明显锯齿。
- [ ] 选中文字时,Bold/Italic 按钮自动高亮(若本期做了"激活态指示")。
- [ ] 拖窄窗口,次要组折叠进"⋯",不出现横向滚动条。
- [ ] 主题切换、Tab 切换都有平滑过渡。

### HTML 导出
- [ ] 含本地图片的 .md 导出后,离线打开图片正常显示。
- [ ] 含 Mermaid 图表,导出后图表渲染正确。
- [ ] 含代码块(含 highlight.js 高亮),导出后高亮样式与预览一致。
- [ ] 含 KaTeX 公式,导出后正常渲染(可降级到系统字体)。
- [ ] 导出文件 < 5MB(一般文档,不含极大图片)。

### PDF 导出(打印路径)
- [ ] 点击 PDF → 系统打印对话框弹出,可保存为 PDF。
- [ ] 输出 PDF 中**文字可选中、可搜索**(不是图片)。
- [ ] PDF 中代码块背景色保留(开启 "Background graphics")。
- [ ] 标题不孤悬一行;代码块/表格不被切断。
- [ ] 工具栏、Tab 栏、状态栏不出现。

## 七、质量门

- [ ] `npm run build`(vue-tsc + vite)零错误
- [ ] `cargo check` 零错误(本期无 Rust 改动但仍跑一次)
- [ ] 真机打 NSIS 包并自测主要流程
- [ ] 关键流程录屏:启动 → 编辑 → 插入图片(本地) → 切主题 → 导出 HTML → 导出 PDF
- [ ] README 同步更新(版本、特性、PDF 导出方式说明)

## 八、发布 Checklist

- [ ] 三处 version → 1.1.0
- [ ] `ROADMAP_V1.1.0.md` 自测项全部勾完
- [ ] `npm version 1.1.0`(只用于校验,真正改是手改三处)
- [ ] `npm run tauri build` 在 Win 10 / Win 11 各跑一次
- [ ] 验证 .md 文件关联仍正常(不应被本期影响)
- [ ] 打 tag:`git tag -a v1.1.0 -m "InkStone MD 1.1.0"` 并推 `origin`

## 九、风险与回退

| 风险 | 缓解 |
|---|---|
| Lucide 图标在 Tauri WebView2 渲染异常 | 图标全部走 `currentColor`,出问题时降到 emoji 是几行 diff |
| `window.print()` 在某些 WebView 版本不稳定 | 旧实现保留为 "PDF (图片式)" 二级菜单 |
| 单文件 HTML 含大量图片导致几 MB | 导出时弹"图片 X 张共 Y MB,继续?"的二次确认;或加一个"是否压缩图片(走后端 `compress_image`)"的选项(V1.1.0 可不做) |
| `App.vue` 继续涨到 4000+ 行 | 接受。明确记入 V1.2 候选:拆出 `Toolbar.vue` / `ExportPanel.vue` |

## 十、不在本期范围(留 V1.2+ 候选)

- DOCX / EPUB 导出
- 拼写检查
- 表格可视化编辑回写 md
- 代码块行号
- 字体/字号/行宽偏好设置
- 多窗口/双开同一文件
- 工具栏自定义(拖拽)
- 浮动气泡菜单
- 拆分 `App.vue` 组件化
