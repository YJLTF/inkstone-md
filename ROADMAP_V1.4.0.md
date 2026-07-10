# InkStone MD V1.4.0 发布规划

> 目标:做一轮**架构治理 + 缺陷修复型**迭代。两大任务:① 把 4400+ 行的 `App.vue` 按功能拆分为组件 + composable,降低维护成本,为后续功能扩展打基础;② 彻底修复 PDF 导出的三个顽疾(显示不全、状态栏泄漏、浏览器页眉页脚),做到"所见即所导"。
>
> 本期 Rust 端零改动,所有工作在前端。无新增依赖(`jspdf` / `html2canvas` 为历史遗留,本期 PDF 方案不依赖它们)。

## 一、版本基线

| 项 | 当前 (1.3.0) | 目标 (1.4.0) |
|---|---|---|
| `package.json` version | 1.3.0 | **1.4.0** |
| `src-tauri/Cargo.toml` version | 1.3.0 | **1.4.0** |
| `src-tauri/tauri.conf.json` version | 1.3.0 | **1.4.0** |
| 分支 | `main`(已发布 1.3.0) | `release/v1.4.0`(本期) |
| Tag | `v1.3.0` 已存在 | `v1.4.0`(构建并自测通过后打) |

> 三处 version 必须**同步**改,缺一即 `tauri build` 失败。规则见 `AGENTS.md` "版本号必须三处同步"。

## 二、总体方向

| # | 主题 | 现状痛点 | V1.4.0 目标 |
|---|---|---|---|
| 1 | **PDF 导出顽疾** | `window.print()` 打印整个应用 DOM:状态栏无 `.status-bar` class 无法被 `@media print` 隐藏;预览区 `overflow:auto` + flex 定高导致超长内容被裁切;浏览器/WebView2 默认在页眉页脚加日期 + "InkStone MD" 标题 | 改用**隐藏 iframe 打印**:iframe 内只放文档渲染内容,彻底隔离应用 chrome;输出 PDF 仅含预览正文,无状态栏、无页眉页脚 |
| 2 | **App.vue 组件化** | 单文件 4400 行(script 2860 + template 622 + style 955),31 个 ref / 101 个函数全平铺在一个 setup 作用域,无 composable / 无组件目录,改一处要翻全文找引用,极易引入"引用顺序"类运行时崩溃 | 拆分为 **composable(逻辑)+ SFC 组件(视图)** 双层架构,`App.vue` 缩至 ~300 行布局壳;新增 `src/components/` 与 `src/composables/` 目录 |

不做:
- 不引入状态管理库(Pinia 等)。用 composable 返回的共享 ref 即可,不增依赖。
- 不改 Rust 端命令与插件配置。
- 不改渲染样式、不改文件关联 / 单实例 / 图片本地化等已稳定链路。
- 不新增功能(DOCX/EPUB、设置面板等仍在后续版本)。

## 三、当前 App.vue 结构现状(拆分依据)

对 `src/App.vue`(共 4440 行)的完整测绘:

### 3.1 三大块行号分布

| 块 | 行范围 | 行数 |
|---|---|---|
| `<script setup lang="ts">` | L1 – L2860 | ~2860 |
| `<template>` | L2862 – L3483 | ~622 |
| `<style scoped>` | L3485 – L4440 | ~955 |

### 3.2 script setup 功能区块

| 区块 | 行范围 | 职责 | 对应拆分目标 |
|---|---|---|---|
| 导入 + md 实例 + 默认内容 | L1–103 | MarkdownIt 初始化、插件、icon 导入、`defaultContent` | `composables/useMarkdownRender.ts` |
| 核心 ref:tab / 视图 / 主题 | L105–178 | `tabs`、`activeTabId`、`viewMode` 组、`themeName` 组、`sidebarMode` 组 | `composables/useTabs.ts` / `useTheme.ts` |
| 工作区 / 文件树 / 右键菜单 / 重命名 | L180–213 | `workspacePath`、`fileTree`、`contextMenu`、`renaming` | `composables/useWorkspace.ts` |
| 最近文件 | L214–254 | `recentFiles` + localStorage 读写 | `composables/useWorkspace.ts` |
| 资产(图片)管理 | L256–512 | `documentAssets` computed、压缩/重命名/移动/删除 | `composables/useAssets.ts` |
| 弹窗 / 拖拽 / 快捷键元数据 | L513–535 | `showShortcutsModal`、`showAboutModal`、`SHORTCUTS` | `composables/useShortcuts.ts` |
| 搜索状态 + 文件树渲染函数 | L537–611 | `showSearch` 组、`renderFileTree()`(h 函数) | `composables/useSearch.ts` + `components/TheSidebar.vue` |
| 图片路径预处理 | L612–712 | `toTauriAssetUrl()`、`preprocessImageSrcs()`、`preprocessToc()` | `composables/useMarkdownRender.ts` |
| HTML 后处理 / 交互包装 | L721–1098 | `wrapImagesForInteraction`、`wrapCodeBlocks`、`bindCodeToolbar`、`wrapTablesForEdit`、`bindTableToolbar`、`bindImageToolbar`、`bindTocNavigation` | `composables/useMarkdownRender.ts`(与 `:deep` 样式绑定) |
| 核心 computed + 渲染管线 | L1100–1216 | `activeTab`、`charCount`、`wordCount`、`headings`、`renderedHTML`、`renderMermaidDiagrams`、`windowTitle` | `composables/useTabs.ts` / `useMarkdownRender.ts` |
| 杂项 watch | L1218–1236 | search 刷新、tab 切换、资产刷新 | 各 composable 内部 |
| 编辑器智能输入 | L1238–1443 | `pairConfig`、`handleKeydown`(配对/列表续行/Tab 导航) | `composables/useEditor.ts` |
| Tab 操作 + 文件 IO | L1445–1554 | `handleInput`、`setActiveTab`、`closeTab`、`createNewTab`、`openFile`、`openFolder`、`loadFileTree` | `composables/useTabs.ts` / `useWorkspace.ts` |
| 右键菜单动作 | L1555–1742 | 新建文件/文件夹、重命名、删除 | `composables/useWorkspace.ts` |
| 保存 / 插入 / 粘贴 | L1744–1897 | `saveFile`、`saveFileAs`、`insertImage`、`insertText`、`handlePaste`、`insertFormat`、`insertHeading` | `composables/useTabs.ts` / `useEditor.ts` |
| 大纲导航 | L1899–1943 | `jumpToHeading`、`navigateToHeading` | `composables/useOutline.ts` |
| **导出子系统** | L1945–2386 | `captureCurrentTheme`、`inlineImagesInMarkdown`、`renderHTMLForExport`、`EXPORT_BASE_CSS`、`PRINT_CSS`、`exportHTML`、`exportPDF`、`showPrintHint` | `composables/useExport.ts`(**任务 1 改造重点**) |
| UI 切换 | L2388–2413 | `toggleSidebar`、`toggleDark`、`toggleScrollSync` | `composables/useTheme.ts` / `App.vue` |
| 滚动同步 + 侧栏拖拽 | L2415–2515 | `syncPreviewFromEditor`、`syncEditorFromPreview`、`updateActiveHeadingFromScroll`、`startResize`/`doResize`/`stopResize` | `composables/useScrollSync.ts` |
| 搜索逻辑 | L2517–2574 | `performSearch`、`highlightCurrentMatch`、`searchNext`/`searchPrev`、`replaceCurrent`/`replaceAll` | `composables/useSearch.ts` |
| 拖放 | L2576–2660 | `handleDragEnter/Leave/Over`、`handleDrop`、`handleImageDrop` | `composables/useTabs.ts` / `useEditor.ts` |
| 搜索面板开关 | L2662–2676 | `closeSearch`、`openSearch` | `composables/useSearch.ts` |
| 生命周期 onMounted | L2678–2853 | 主题应用、mermaid 初始化、最近文件加载、ResizeObserver、30s 自动保存、`listen("menu-event")` 调度、`listen("open-file")`、`emit("frontend-ready")`、全局 keydown、selectionchange、capture scroll | `App.vue`(编排层) |
| onUnmounted | L2855–2859 | 清理自动保存定时器 | `App.vue` |

### 3.3 template DOM 区域

| 区域 | 行范围 | 拆分目标组件 |
|---|---|---|
| 拖拽遮罩 | L2871–2882 | `App.vue` 内联(极小) |
| 工具栏 | L2884–3080 | `components/TheToolbar.vue` |
| PDF 打印提示 | L3082–3092 | `components/PrintHint.vue` |
| 搜索面板 | L3094–3121 | `components/SearchPanel.vue` |
| Tab 栏 | L3123–3154 | `components/TheTabBar.vue` |
| 侧边栏(树/大纲/最近/资产 + 右键菜单) | L3158–3372 | `components/TheSidebar.vue` |
| 编辑器区域(纯编辑/纯预览/分栏) | L3374–3406 | `components/EditorPane.vue` |
| 状态栏 | L3409–3427 | `components/TheStatusBar.vue` |
| 快捷键对话框 | L3429–3457 | `components/ShortcutsModal.vue` |
| 关于对话框 | L3459–3481 | `components/AboutModal.vue` |

### 3.4 共享状态耦合度

| 耦合级别 | ref / computed | 数量 |
|---|---|---|
| **高**(3+ 区域消费) | `tabs`、`activeTabId`、`activeTab`、`isDark`、`themeName`、`viewMode`/`showSplit`/`showPreview`、`headings`、`renderedHTML`、`workspacePath`、`fileTree` | ~11 |
| **中**(2 区域消费) | `showSidebar`、`sidebarMode`、`sidebarWidth`、`isResizing`、`scrollSync`、`contextMenu`、`renaming`、`recentFiles`、`showSearch` 组、`isDragging`/`dragCounter`、`activeHeadingIndex` | ~15 |
| **低**(单区域) | `toolbarRef`、`overflowLevel`、`showShortcutsModal`、`showAboutModal`、`showPrintHint`、`selectedCount`、`documentAssets` 等 | ~12 |

> **关键结论**:`activeTab.value.content` 被 ≥12 个函数读写,是全文件最高扇出的状态。拆分时必须先抽 `useTabs` composable,让其他 composable / 组件从同一个共享 ref 引用,而非各自持有副本。

## 四、任务 1 · 修复 PDF 导出(优先,独立可验收)

### 4.1 现状与根因

当前 `exportPDF()`([App.vue:2368](file:///workspace/src/App.vue#L2368))的逻辑:

```ts
async function exportPDF() {
  setViewMode('preview');
  await nextTick();
  await new Promise((r) => setTimeout(r, 150));
  window.print();  // ← 打印整个应用 DOM
}
```

**三个根因:**

| 问题 | 根因 | 代码位置 |
|---|---|---|
| ① 状态栏泄漏到 PDF | 状态栏元素(L3409–3427)**没有 `.status-bar` class**,只有内联 Tailwind 工具类。`@media print`(L3696–3739)的隐藏列表里写了 `.status-bar` 但选择器**匹配不到**该元素;另一份 `PRINT_CSS`(L2281)仅在导出 HTML 时注入,不影响实时打印 | L3409 无语义 class;L3704 隐藏列表不含状态栏实际 class |
| ② 内容显示不全 | 预览容器 `.preview-area`(L3387/L3402)有 `overflow-y-auto` + flex 父级 `overflow-hidden` + `h-full` 定高。浏览器打印时,溢出滚动容器中**视口外的内容被裁切**——这是 flex+overflow 布局的经典打印陷阱 | L3375 `.editor-area { overflow-hidden }`、L3387 `.preview-area { overflow-y-auto }` |
| ③ 顶部日期 + "InkStone MD" | WebView2 / Edge 的系统打印对话框默认开启**页眉页脚**:页眉含日期 + 页面标题(`document.title`,即 "InkStone MD"),页脚含 URL + 页码。这是浏览器 chrome 层行为,CSS 无法关闭 | `index.html` 的 `<title>InkStone MD</title>` 被浏览器用作打印页眉标题 |

### 4.2 方案:隐藏 iframe 打印(推荐)

**核心思路**:不打印应用 DOM,而是动态创建一个隐藏 `<iframe>`,在 iframe 内写入**仅含文档正文的独立 HTML 文档**(复用现有 `renderHTMLForExport` + `inlineImagesInMarkdown` + `captureCurrentTheme` + `EXPORT_BASE_CSS`),然后对 iframe 调用 `print()`。

**为什么 iframe 能同时解决三个问题:**

| 问题 | iframe 如何解决 |
|---|---|
| ① 状态栏泄漏 | iframe 内**只有** `<div class="markdown-body">正文</div>`,根本不存在状态栏 / 工具栏 / 侧边栏 → 无需任何 `display:none` hack |
| ② 内容不全 | iframe 是独立文档,正文自然流式排版,无 `overflow:auto` / flex 定高容器 → 内容完整铺满多页 |
| ③ 页眉页脚 | iframe 文档的 `<title>` 设为**空字符串**,页眉不显示 "InkStone MD";日期/页码仍由打印对话框控制,但配合"引导用户关闭页眉页脚"可彻底消除(见 4.4) |

#### 4.2.1 实现步骤

**(1) 新增 `printDocument()` 函数(替代 `exportPDF` 内的 `window.print()`)**

```ts
/**
 * 构建隐藏 iframe 并打印纯文档内容。
 * @param sourceMd 可选;默认取 activeTab.content
 */
async function printDocument(sourceMd?: string): Promise<void> {
  const tab = activeTab.value;
  if (!tab) return;

  // 1) 复用现有导出管线:内联图片 → 渲染 HTML(无交互包装)
  const withImages = await inlineImagesInMarkdown(sourceMd ?? tab.content, tab.path);
  const withToc = preprocessToc(withImages, headings.value);
  const bodyHtml = renderHTMLForExport(withToc);

  // 2) 截取主题快照
  const theme = captureCurrentTheme();

  // 3) 组装独立 HTML 文档(title 留空 → 打印无页眉标题)
  const docHtml = buildPrintHtml(bodyHtml, theme);

  // 4) 创建隐藏 iframe
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentWindow!.document;
    doc.open();
    doc.write(docHtml);
    doc.close();

    // 5) 等待图片 / 字体加载完成
    await waitForImagesAndFonts(iframe.contentWindow!);

    // 6) 触发打印(对 iframe 的 contentWindow 调用)
    iframe.contentWindow!.focus();
    iframe.contentWindow!.print();
  } finally {
    // 7) 延迟移除 iframe(print 是同步阻塞的,结束后才执行)
    setTimeout(() => iframe.remove(), 1000);
  }
}
```

**(2) 新增 `buildPrintHtml()` 辅助函数**

将 `exportHTML` 中拼装 HTML 的逻辑提取为公共函数,导出 HTML 和打印复用同一套模板:

```ts
function buildPrintHtml(bodyHtml: string, theme: ReturnType<typeof captureCurrentTheme>): string {
  return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="${theme.dataTheme}"${theme.isDark ? ' class="dark"' : ''}>
<head>
<meta charset="UTF-8">
<title></title>  <!-- 空 title:打印页眉不显示应用名 -->
<style>
:root {
  --ink-font: ${theme.fontFamily};
  --ink-bg: ${theme.isDark ? theme.bodyBg : '#ffffff'};
  --ink-fg: ${theme.isDark ? theme.bodyColor : '#000000'};
}
${EXPORT_BASE_CSS}
${theme.highlightCss}
${katexCss}
${PRINT_CSS}
</style>
</head>
<body>
<div class="markdown-body">${bodyHtml}</div>
</body>
</html>`;
}
```

> 注意:打印用 `PRINT_CSS`(L2277–2292)已有 `@page { size: A4; margin: 15mm }` 和分页控制(`page-break-inside: avoid` 等),直接复用。

**(3) `exportPDF` 改为调用 `printDocument`**

```ts
async function exportPDF() {
  if (!activeTab.value) return;
  showPrintHint.value = false;
  localStorage.setItem('pdfHintShown', 'true');
  try {
    await printDocument();
  } catch (e) {
    console.error('打印失败:', e);
  }
}
```

> 不再需要 `setViewMode('preview')` + `nextTick` + `setTimeout`——因为 iframe 是独立文档,与当前视图模式无关。用户在任意视图模式下都能导出 PDF。

**(4) 新增 `waitForImagesAndFonts()` 工具函数**

确保 iframe 内的 base64 图片和字体加载完成后再打印,避免空白:

```ts
function waitForImagesAndFonts(win: Window): Promise<void> {
  const imgPromises = Array.from(win.document.images).map(
    (img) => img.complete ? Promise.resolve() : new Promise<void>((res) => { img.onload = () => res(); img.onerror = () => res(); })
  );
  const fontPromise = (win as any).fonts?.ready ?? Promise.resolve();
  return Promise.all([...imgPromises, fontPromise]).then(() => undefined);
}
```

#### 4.2.2 删除/清理

- **删除** `<style scoped>` 里的 `@media print` 块(L3696–3739):iframe 方案下应用 DOM 不再参与打印,该块已无意义。
- **保留** `PRINT_CSS` 常量(L2277–2292):它被注入到 iframe 文档中,控制分页。

### 4.3 备选方案评估(不采用,记录决策)

| 方案 | 优点 | 否决理由 |
|---|---|---|
| **A. 修复现有 `@media print`**(给状态栏加 class + 修 overflow) | 改动最小 | 治标不治本:flex+overflow 布局的打印裁切问题难以用 CSS 彻底消除;浏览器页眉页脚无法用 CSS 关闭;以后每次改 UI 布局都要同步维护打印隐藏列表,脆弱 |
| **B. html2canvas + jsPDF** | 完全控制输出,无浏览器对话框 | 正文被栅格化为图片,**文字不可选不可搜索**,PDF 体积大,多页拼接有断裂风险。V1.1.0 正是因此弃用此方案,本期不走回头路 |
| **C. `window.open()` 新窗口打印** | 与 iframe 思路相同 | Tauri 的 CSP / 弹窗策略可能拦截 `window.open()`;iframe 更可靠且不闪新窗口 |

### 4.4 页眉页脚引导(配合 iframe 方案)

iframe 方案已消除 "InkStone MD" 标题(空 title)。对于**日期 + 页码**,这是 WebView2 打印对话框的系统行为:

- **Win10/11** 的 "Microsoft Print to PDF" 对话框 → 更多设置 → 取消勾选"页眉和页脚"即可。
- 更新 `PrintHint` 提示文案,增加一句:建议在打印对话框中关闭"页眉和页脚"以获得纯净 PDF。

> 不做强制:用户可能需要页码,保留选择权。

### 4.5 自测用例

- [ ] 在分栏模式下点"导出 PDF" → 系统打印对话框弹出,选 "Microsoft Print to PDF" → 生成 PDF。
- [ ] PDF 中**无状态栏**(无"已保存"/字符数/词数等)。
- [ ] PDF 中**无工具栏、侧边栏、Tab 栏**。
- [ ] PDF 中**无日期、无 "InkStone MD" 标题**(关闭页眉页脚后)。
- [ ] 超长文档(50+ 页)PDF 内容**完整**,无裁切,分页正确。
- [ ] 含本地图片的文档 → 图片正常显示在 PDF 中(非空白)。
- [ ] 含网络图片的文档 → 图片已内联,PDF 可离线查看。
- [ ] 含 Mermaid 图表 → PDF 中图表正确渲染(非源码)。
- [ ] 含 KaTeX 公式 → PDF 中公式正确渲染。
- [ ] 含表格 → 表格不被跨页截断(`page-break-inside: avoid` 生效)。
- [ ] 暗色主题下导出 → PDF 背景为白色浅色(打印友好的 `PRINT_CSS` 生效)。
- [ ] GitHub / OneDark / Typora 四种主题分别导出 → 样式与预览一致。
- [ ] 导出 HTML 功能不受影响(复用了 `buildPrintHtml` 提取的公共逻辑)。
- [ ] 导出 PDF 时**不需要切到预览模式**(编辑/分栏模式直接导出)。

## 五、任务 2 · App.vue 组件化拆分

### 5.1 架构设计

采用 **composable(逻辑)+ SFC 组件(视图)** 双层架构,不引入 Pinia(共享 ref 足够)。

```
src/
├── App.vue                      # ~300 行:布局壳 + composable 编排 + 生命周期
├── main.ts                      # 不变
├── style.css                    # 不变(全局 markdown 主题样式)
├── types/
│   └── index.ts                 # 所有 interface / type 集中声明
├── composables/
│   ├── useTabs.ts               # tab CRUD + 文件 IO + 保存 + 粘贴 + 拖放
│   ├── useWorkspace.ts          # 工作区 / 文件树 / 右键菜单 / 重命名 / 最近文件
│   ├── useTheme.ts              # themeName / isDark / setTheme / toggleDark
│   ├── useMarkdownRender.ts     # md 实例 + 图片预处理 + HTML 后处理 + renderedHTML + headings + bind* 函数
│   ├── useEditor.ts             # viewMode + 智能输入 handleKeydown + insertText/insertFormat/insertHeading
│   ├── useSearch.ts             # 搜索替换全套状态 + 逻辑
│   ├── useScrollSync.ts         # 滚动同步 + 大纲高亮 + 侧栏拖拽
│   ├── useAssets.ts             # 资产管理(扫描/压缩/重命名/移动)
│   ├── useExport.ts             # 导出 HTML + 导出 PDF(含任务 1 的 printDocument)
│   └── useShortcuts.ts          # SHORTCUTS 常量 + 全局键盘快捷键
└── components/
    ├── TheToolbar.vue           # 工具栏(格式按钮 + 插入 + 导出 + 视图 + 主题)
    ├── TheTabBar.vue            # Tab 标签栏
    ├── TheSidebar.vue           # 侧边栏容器(含树/大纲/最近/资产四种模式 + 右键菜单)
    ├── EditorPane.vue           # 编辑器区域(纯编辑/纯预览/分栏三态)
    ├── PreviewBody.vue          # markdown-body 渲染容器 + :deep 交互样式
    ├── SearchPanel.vue          # 搜索替换面板
    ├── TheStatusBar.vue         # 底部状态栏
    ├── ContextMenu.vue          # 右键菜单(通用)
    ├── PrintHint.vue            # PDF 打印提示横幅
    ├── ShortcutsModal.vue       # 快捷键对话框
    └── AboutModal.vue           # 关于对话框
```

### 5.2 composable 间依赖关系(声明顺序)

遵循 AGENTS.md 的"引用顺序"规则——被引用的 ref/computed 必须先初始化。composable 在 `App.vue` 的调用顺序:

```
App.vue setup 执行顺序:
  1. useTheme()          → themeName, isDark          (无依赖)
  2. useTabs()           → tabs, activeTabId, activeTab(无依赖)
  3. useMarkdownRender() → headings, renderedHTML      (依赖 activeTab)
  4. useEditor()         → viewMode, handleKeydown ... (依赖 activeTab, insertText 写 tab.content)
  5. useWorkspace()      → workspacePath, fileTree ... (依赖 tabs, setActiveTab)
  6. useAssets()         → documentAssets               (依赖 activeTab, workspacePath)
  7. useSearch()         → showSearch 组                (依赖 activeTab)
  8. useScrollSync()     → scrollSync, sync fns         (依赖 viewMode, headings)
  9. useExport()         → exportHTML, exportPDF        (依赖 activeTab, headings, renderedHTML)
 10. useShortcuts()      → SHORTCUTS, 全局键盘          (依赖上述各 toggle)
```

> 每个 composable 返回 `{ ref, computed, function }` 对象,`App.vue` 解构后通过 props / emits 传给组件,或直接传入下一个 composable。

### 5.3 拆分步骤(每步独立可验证)

> **铁律**:每完成一步,立即 `npm run build`(vue-tsc 类型检查)+ `npm run tauri dev` 冒烟测试。任何一步红了就停在原地修,不往下走。

#### 步骤 0:提取类型声明(零风险)

- 新建 `src/types/index.ts`,将 `FileEntry`、`Tab`、`Heading`、`ThemeName`、`ViewMode`、`ContextMenuState`、`DocumentAsset`、`ImageAlign` 从 App.vue 内联声明移出。
- `App.vue` 改为 `import type { ... } from './types'`。
- **验证**:`npm run build` 通过。

#### 步骤 1:提取 `useTheme` composable(低风险热身)

- 搬出:`themeName`、`isDark`、`THEME_OPTIONS`、`setTheme()`、`toggleDark()`、`toggleSidebar()`(UI 切换归这里或单独)。
- `App.vue` 解构使用。
- **验证**:切换主题/深色模式正常,重启恢复。

#### 步骤 2:提取 `useTabs` composable(核心,高风险)

- 搬出:`tabs`、`activeTabId`、`activeTab`(computed)、`charCount`、`wordCount`(computed)、`windowTitle`(computed)、`setWindowTitle()`、`createNewTab()`、`openFile()`、`closeTab()`、`setActiveTab()`、`handleInput()`、`saveFile()`、`saveFileAs()`、`handleDrop()`。
- **关键**:`activeTab` 是全文件最高扇出状态,后续 composable 都需要它。`useTabs()` 返回的 `activeTab` 是一个 `ComputedRef<Tab | undefined>`,其他 composable 接收它作为参数。
- **验证**:新建/打开/保存/关闭 Tab 正常,自动保存正常,双击 .md 打开正常。

#### 步骤 3:提取 `useMarkdownRender` composable(核心)

- 搬出:`md` 实例、`IMAGE_SCALES`、`isAbsolutePath()`、`posixNormalize()`、`toTauriAssetUrl()`、`preprocessImageSrcs()`、`preprocessToc()`、`slugify()`、`escapeHtml()`、`addHeadingIds()`、`findTableRanges()`、`wrapImagesForInteraction()`、`wrapCodeBlocks()`、`bindCodeToolbar()`、`wrapTablesForEdit()`、`tableToMarkdown()`、`bindTableToolbar()`、`applyImageTransforms()`、`bindImageToolbar()`、`bindTocNavigation()`、`headings`(computed)、`renderedHTML`(computed)、`renderMermaidDiagrams()`、`watch(renderedHTML)`。
- **注意引用顺序**:`headings` 必须在 `renderedHTML` 之前声明(AGENTS.md 记录的坑)。在 composable 内部确保顺序。
- **注意**:`bindTableToolbar` 会回写 `tab.content`,需要接收一个"写入 activeTab content"的回调函数。
- 接收参数:`activeTab: ComputedRef`。
- **验证**:预览渲染正常,代码块复制/表格编辑/图片缩放交互正常,Mermaid/KaTeX 渲染正常。

#### 步骤 4:提取 `useEditor` composable

- 搬出:`viewMode`、`showSplit`(computed)、`showPreview`(computed)、`setViewMode()`、`pairConfig`、`handleKeydown()`、`insertText()`、`insertFormat()`、`insertHeading()`、`insertImage()`、`handlePaste()`、`getVisibleEditor()`、`getVisiblePreview()`。
- 接收参数:`activeTab`,一个"写入 content"回调。
- **验证**:三视图模式切换,快捷键输入(配对/列表续行/Tab 导航),粘贴图片。

#### 步骤 5:提取 `useWorkspace` + `useAssets` composable

- `useWorkspace`:`workspacePath`、`fileTree`、`autoSaveInterval`、`contextMenu`、`renaming`、`recentFiles` 系列、`openFolder()`、`loadFileTree()`、`renderFileTree()`、`showContextMenu*`、`handleNewFile/Folder`、`handleRename`、`confirmRename`、`cancelRename`、`handleDelete`。
- `useAssets`:`documentAssets`(computed)、`assetExistsCache`、`refreshAssetExists()`、`revealAsset()`、`copyAssetPath()`、`removeAssetReference()`、`renameAsset()`、`moveAsset()`、`getFileSize()`、`formatBytes()`、`compressAsset()`。
- **验证**:文件树浏览/新建/重命名/删除,资产面板操作,图片压缩。

#### 步骤 6:提取 `useSearch` + `useScrollSync` composable

- `useSearch`:`showSearch` 组全部 + `performSearch` / `highlightCurrentMatch` / `searchNext` / `searchPrev` / `replaceCurrent` / `replaceAll` / `closeSearch` / `openSearch` + `watch(searchQuery)`。
- `useScrollSync`:`scrollSync`、`syncPreviewFromEditor`、`syncEditorFromPreview`、`updateActiveHeadingFromScroll`、`toggleScrollSync()`、`startResize` / `doResize` / `stopResize`、`jumpToHeading` / `navigateToHeading`。
- 接收参数:`activeTab`、`viewMode`、`headings`。
- **验证**:搜索替换,滚动同步(F7),大纲跳转。

#### 步骤 7:提取 `useExport` composable(含任务 1 成果)

- 搬出:`captureCurrentTheme()`、`getMimeFromExt()`、`bytesToBase64()`、`fetchAsDataUri()`、`inlineImagesInMarkdown()`、`renderHTMLForExport()`、`EXPORT_BASE_CSS`、`PRINT_CSS`、`exportHTML()`、`buildPrintHtml()`、`printDocument()`、`waitForImagesAndFonts()`、`exportPDF()`、`showPrintHint`、`dismissPrintHint()`。
- 接收参数:`activeTab`、`headings`。
- **验证**:导出 HTML 正常,导出 PDF(iframe 方案)正常。

#### 步骤 8:提取 `useShortcuts` composable

- 搬出:`SHORTCUTS` 常量、`appVersion`、`showShortcutsModal`、`showAboutModal`。
- 全局 keydown 监听可留在 `App.vue` onMounted 或移入此 composable(返回 `setupShortcuts(deps)` 函数)。
- **验证**:F1 弹快捷键,关于对话框,Esc 关闭。

#### 步骤 9:提取叶子组件(从易到难)

按以下顺序逐个提取,每个都是纯视图 + props/emits:

1. `AboutModal.vue` + `ShortcutsModal.vue`(最简单,几乎无交互)
2. `PrintHint.vue`(单个 ref + 一个函数)
3. `TheStatusBar.vue`(只读 props 展示)
4. `SearchPanel.vue`(props + emits)
5. `ContextMenu.vue`(props + emits)

每个组件提取后,`App.vue` 模板对应区域替换为 `<ComponentName :prop="..." @event="..." />`。
**验证**(每个组件后):对应区域功能正常。

#### 步骤 10:提取 `TheToolbar.vue`(中等复杂度)

- Props: `viewMode`、`showSplit`、`showPreview`、`themeName`、`isDark`、`overflowLevel`。
- Emits: `insert-format`、`insert-heading`、`insert-text`、`insert-image`、`set-view-mode`、`set-theme`、`toggle-dark`、`export-html`、`export-pdf` 等。
- 内部状态:`overflowLevel`、`overflowMenuOpen`、`toolbarRef`、`updateOverflow()`(用 `onMounted` + `ResizeObserver`)。
- **验证**:工具栏所有按钮可用,响应式折叠正常。

#### 步骤 11:提取 `TheTabBar.vue`(中等)

- Props: `tabs`、`activeTabId`、`showSidebar`。
- Emits: `set-active`、`close-tab`、`new-tab`、`toggle-sidebar`。
- **验证**:Tab 切换/关闭/新建正常,中键关闭正常。

#### 步骤 12:提取 `TheSidebar.vue`(最复杂,最后做)

- 包含四种模式(树/大纲/最近/资产)+ 右键菜单 + 重命名输入 + 拖拽手柄。
- Props 较多,考虑用 `provide/inject` 传 composable 引用而非逐个 props(减少 props drilling)。
- 子结构可进一步拆:`FileTreeView`(render 函数)、`OutlinePanel`、`RecentPanel`、`AssetsPanel`。
- **验证**:四种侧边栏模式全部功能正常,右键菜单,重命名,资产操作,拖拽调宽。

#### 步骤 13:提取 `EditorPane.vue` + `PreviewBody.vue`

- `EditorPane.vue`:管理三个互斥 pane(edit/split/preview),两个 textarea + preview 容器。
- `PreviewBody.vue`:`<div class="markdown-body" v-html="...">` + 所有 `:deep` 交互样式(图片/代码块/表格/TOC)。这个组件持有 `useMarkdownRender` 返回的 bind 函数(在 `onUpdated` / `watch` 中调用)。
- **验证**:三模式切换,编辑输入,预览渲染,交互工具栏(复制/编辑/缩放)。

#### 步骤 14:收尾

- `App.vue` 缩至布局壳(~300 行):根 div + 组件编排 + onMounted/onUnmounted 生命周期 + 全局事件监听。
- 清理未使用的导入和代码。
- **验证**:`npm run build` 零错误,全功能冒烟。

### 5.4 `:deep` 样式迁移规则

当前 `<style scoped>` 中大量 `:deep` 选择器(L4006–4307)用于 `v-html` 注入的富内容(图片工具栏、代码块工具栏、表格工具栏、TOC)。这些样式**必须跟随 `PreviewBody.vue` 组件**,因为:
- scoped 样式只能穿透到当前组件渲染的 DOM;
- `v-html` 内容没有 scoped 属性标记,必须用 `:deep` 才能命中。

迁移时,将以下 `:deep` 块整体移入 `PreviewBody.vue` 的 `<style scoped>`:
- `.ink-image-wrap` / `.ink-image-toolbar`(L4006–4072)
- `.ink-toc*`(L4074–4124)
- `.ink-codeblock*`(L4126–4235)
- `.ink-table*`(L4237–4307)

其余非 `:deep` 的 chrome 样式(工具栏、Tab 栏、状态栏等)随对应组件迁移。

### 5.5 自测用例(组件化回归)

> 拆分是纯重构,行为不变。以下用例确保**回归零退化**。

- [ ] 新建 Tab → 输入 → 保存 → 关闭 → 重开,内容不丢。
- [ ] 打开文件夹 → 文件树正常 → 双击 .md 打开。
- [ ] 四种主题切换 + 深色模式,渲染样式正确。
- [ ] 编辑/分栏/预览三模式切换(`Ctrl+\`)。
- [ ] 分栏滚动同步(F7)。
- [ ] 代码块复制按钮、语言标签、行号。
- [ ] 表格右键编辑、复制为 Markdown。
- [ ] 图片缩放、对齐、复制路径、打开。
- [ ] 搜索替换(单个/全部)。
- [ ] 大纲跳转(点击标题滚动 + 高亮)。
- [ ] 粘贴剪贴板图片 → 自动存入 assets/ → 插入链接。
- [ ] 拖放 .md 打开;拖放图片插入。
- [ ] 导出 HTML;导出 PDF(任务 1 成果)。
- [ ] 快捷键对话框(F1);关于对话框。
- [ ] 文件树右键:新建文件/文件夹、重命名、删除。
- [ ] 资产面板:显示、压缩、重命名、移动、删除引用。
- [ ] 工具栏响应式折叠(窗口缩窄时溢出菜单出现)。
- [ ] 30s 自动保存。
- [ ] 双击 .md 文件 → 单实例 → 窗口前置并打开文件。

## 六、关键文件与改动落点

| 文件 | 改动概要 |
|---|---|
| `package.json` | version → 1.4.0(无新依赖) |
| `src-tauri/Cargo.toml` | version → 1.4.0 |
| `src-tauri/tauri.conf.json` | version → 1.4.0 |
| `src/App.vue` | **大幅瘦身**:从 4400 行 → ~300 行。仅保留布局壳 + composable 编排 + 生命周期 |
| `src/types/index.ts` | **新增**:集中类型声明 |
| `src/composables/*.ts` | **新增**:10 个 composable 文件 |
| `src/components/*.vue` | **新增**:11 个 SFC 组件 |
| `README.md` / `README_EN.md` | 版本记录加 1.4.0 条目(组件化 + PDF 修复) |

> Rust 端零改动,无新依赖。

## 七、开发顺序建议

**任务 1(PDF)先做,任务 2(拆分)后做**,原因:
1. PDF 修复是用户直接感知的缺陷,优先兑现价值;
2. PDF 修复改动集中在 `useExport` 区域,独立可验收;
3. 拆分是大规模重构,先修好 PDF 再重构,避免重构中引入新问题叠加在旧 bug 上;
4. 拆分步骤 7(提取 `useExport`)会自然包含任务 1 的 `printDocument` 成果。

```
任务 1(PDF 修复)
  └─ 4.2 实现 printDocument + buildPrintHtml + waitForImagesAndFonts
  └─ 4.2.2 清理 @media print
  └─ 4.5 自测
         │
         ▼
任务 2(组件化拆分,步骤 0→14)
  └─ 步骤 0: 提取类型
  └─ 步骤 1-8: 逐个提取 composable(每步 build + 冒烟)
  └─ 步骤 9-13: 逐个提取组件(每步 build + 冒烟)
  └─ 步骤 14: 收尾
```

## 八、风险与回退

| 风险 | 缓解 |
|---|---|
| **拆分引入运行时崩溃**(computed 引用顺序) | 严格遵循 AGENTS.md 的声明顺序规则;每个 composable 内部确保被引用的 ref 先声明;每步 `npm run tauri dev` 实跑 |
| iframe 打印在某些 WebView2 版本上不触发 `afterprint` | 用 `setTimeout` 延迟移除 iframe(非依赖事件);若极端情况不弹对话框,fallback 回 `window.print()` |
| iframe 内 base64 图片体积过大导致打印卡顿 | 大文档(100+ 图片)先做性能测试;必要时加 loading 指示 |
| composable 间 props drilling 过深 | 对深层嵌套组件(如 Sidebar 子面板)用 `provide/inject` 传 composable 引用,减少 props 层级 |
| 拆分过程中 `vue-tsc` 报类型错误(composable 返回值类型推断) | 给 composable 函数加显式返回类型标注;对 `ComputedRef` 明确泛型 |
| 表格回写(`bindTableToolbar` → `tab.content`)在拆分后丢失写入路径 | composable 接收 `updateContent(newContent: string)` 回调,不直接操作 tab 对象 |
| `:deep` 样式迁移后 v-html 元素样式丢失 | 样式必须跟随 `PreviewBody.vue`;迁移后立即验证富内容交互(代码块/表格/图片) |

## 九、质量门

- [ ] `npm run build`(vue-tsc + vite)零错误、零新增警告
- [ ] `cargo check`(在 `src-tauri/` 目录)零错误(本期预期无 Rust 改动,确认无回归)
- [ ] `App.vue` 行数 < 400(目标 ~300)
- [ ] 全功能回归冒烟(第五节 5.5 全部用例通过)
- [ ] PDF 导出专项测试(第四节 4.5 全部用例通过)
- [ ] 真机打 NSIS 包并自测主要流程
- [ ] 关键流程录屏:导出 PDF(超长文档) → 全功能冒烟(编辑/预览/搜索/大纲/导出)
- [ ] README 同步更新(版本记录 1.4.0)

## 十、发布 Checklist

- [ ] 三处 version → 1.4.0(`package.json` / `Cargo.toml` / `tauri.conf.json`)
- [ ] `ROADMAP_V1.4.0.md` 自测项全部勾完
- [ ] `npm run tauri build` 在 Win 10 / Win 11 各跑一次
- [ ] 验证 .md 文件关联仍正常(不应被本期影响)
- [ ] 验证组件化后窗口标题、自动保存、双击打开等生命周期行为不变
- [ ] 打 tag:`git tag -a v1.4.0 -m "InkStone MD 1.4.0"` 并推 `origin`

## 十一、不在本期范围(留 V1.5+ 候选)

- 设置面板(统一管理所有偏好)
- DOCX / EPUB 导出
- 拼写检查
- 专注模式遮罩级段落淡化
- 打字机模式镜像 div 像素级居中
- macOS 原生菜单适配
- 引入 Pinia 状态管理(当 composable 共享 ref 的维护成本再次升高时考虑)
- 纯前端 PDF 生成(若 iframe + 系统对话框体验仍不满意,评估 jsPDF + vector text 方案)
