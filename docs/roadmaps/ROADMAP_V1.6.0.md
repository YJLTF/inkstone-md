# InkStone MD V1.6.0 发布规划 —— 预览全面增强美化

> **目标**:对 Markdown 预览页做一次**全面增强美化**。
> ① **样式基建**:预览样式 CSS 变量化 + 预览/导出样式单源化,修复亮色模式代码高亮错配;
> ② **语法扩展**:GitHub 提示块、`==高亮==`/`^上标^`/`~下标~`、Front-matter 元信息卡、音视频嵌入;
> ③ **视觉美化**:全元素精修(标题锚点/图注/键帽/折叠块等),四套主题统一受益;
> ④ **阅读体验**:阅读偏好设置面板(字体/字号/行宽/代码高亮主题)、图片灯箱、阅读进度条;
> ⑤ **修复与性能**:导出物 TOC 锚点修复、输入防抖渲染、hljs 减包、死依赖清理。
>
> 本期 Rust 端仅加一个菜单项(`阅读偏好`),无新命令、无插件变更。

## 一、版本基线

| 项 | 当前 (1.5.0) | 目标 (1.6.0) |
|---|---|---|
| `package.json` version | 1.5.0 | **1.6.0** |
| `src-tauri/Cargo.toml` version | 1.5.0 | **1.6.0** |
| `src-tauri/tauri.conf.json` version | 1.5.0 | **1.6.0** |
| Tag | `v1.5.0` 已存在 | `v1.6.0`(构建并自测通过后打) |

> 三处 version 必须**同步**改,缺一即 `tauri build` 失败。规则见 `AGENTS.md`「版本号必须三处同步」。

## 二、决策记录(已与用户对齐)

| 决策点 | 结论 |
|---|---|
| 视觉基调 | **精致化现有 InkStone 风格**,统一间距节奏/圆角/阴影/配色层级,四套主题一起受益 |
| 语法扩展范围 | **四项全做**:GitHub 提示块 + 行内三件套 + Front-matter 元信息卡 + 音视频嵌入 |
| 阅读偏好设置 | **完整设置面板**(新组件 `SettingsModal.vue`),偏好持久化 localStorage |
| Front-matter 实现 | 不引插件,沿用预处理管线自写极简 YAML 子集解析 |
| 设置持久化 | 沿用 localStorage(与 theme/viewMode 一致);localStorage→store 迁移仍是范围外遗留项 |

## 三、现状缺口(来自代码测绘)

| 缺口 | 位置 | 影响 |
|---|---|---|
| `style.css` 全部硬编码颜色,**零 CSS 变量** | `style.css`(1024 行) | 美化需在 4 主题 × 亮暗八种组合里重复配色,无法维护 |
| 预览样式与导出样式是**两份手工副本** | `style.css` vs `constants/exportCss.ts` EXPORT_BASE_CSS | 已知漂移风险,每次美化都要双写 |
| 预览静态导入 `github-dark.css` | `App.vue:10` | 亮色模式下代码 token 仍是暗色配色,对比度错配 |
| hljs 全量导入(~190 语言) | `App.vue:6` | 包体无谓膨胀 |
| 仅 task-lists + footnote 两个插件 | `App.vue:52-53` | 无提示块/高亮标记/上下标等常用语法 |
| 导出物不注入标题 id | `renderHTMLForExport` | 导出 HTML/PDF 中 `[[toc]]`、锚点全部失效 |
| 输入无防抖,每次击键全量重渲染 + mermaid 重渲染 | `handleInput`/`renderedHTML` | 长文档打字卡顿 |
| 编辑器 `:deep()` 内 `.dark :deep(...)` 选择器永不匹配(html 上的 `.dark` 无 scoped 属性) | `EditorPane.vue` | 暗色变体样式实际未生效 |
| 无字体/字号/行宽设置(V1.0.0 起遗留 P2) | — | 阅读体验不可调 |
| 无图片灯箱、无标题锚点、无阅读进度条 | — | 预览交互单薄 |
| `html2canvas`/`jspdf` 死依赖 | `package.json` | 无引用,徒增安装体积 |

## 四、任务分解(实际落地)

### 阶段 A — 样式基建 ✅
- **A1 CSS 变量化**:新建 `src/assets/markdown-body.css`,预览内容全部颜色走 `--ink-md-*` 变量;`:root` 浅色基线 → `.dark` 暗色基线 → 各 `[data-theme]` 块只覆写变量值;`style.css` 瘦身为纯应用外壳(编辑器/预览容器/主题根色/对话框)。
- **A2 单源化**:`markdown-body.css` 为预览内容样式唯一真源——预览由 `main.ts` 正常 import,导出由 `App.vue` 以 `?raw` 内联;`EXPORT_BASE_CSS` 手工副本删除,`exportCss.ts` 只留 `EXPORT_SHELL_CSS` + `PRINT_CSS`。
- **A3 hljs 亮暗自适应 + 减包**:移除静态 `github-dark.css` 导入,改为 `<style id="ink-hljs-theme">` 动态注入,`auto` 档跟随亮暗;hljs 改 `highlight.js/lib/common`(~35 常用语言,补 `src/types/hljs-common.d.ts` 类型垫片)。

### 阶段 B — 语法扩展 ✅
- **B1 依赖**:`markdown-it-github-alerts` / `markdown-it-mark` / `markdown-it-sub` / `markdown-it-sup`(mark/sub/sup 补 `src/types/markdown-it-inline-plugins.d.ts`)。
- **B2 GitHub 提示块**:`classPrefix: "ink-alert"`,lucide 风格 stroke SVG 图标,中文标题(注意/提示/重要/警告/当心),五色语义配色亮暗各一版,样式进 `markdown-body.css`(导出物同样生效)。
- **B3 行内三件套**:`==高亮==`(主题化荧光底)、`^上标^`、`~下标~`。
- **B4 Front-matter 元信息卡**:`extractFrontMatter`(带守卫:开头 `---` 块解析不出键值对则按无 front-matter 处理)→ `parseFrontMatter`(key: value / `- 列表` / 内联数组,中英文键名)→ `renderFrontMatterCard`(标题强调 + 标签 chips + 普通键值行;**内部不用 h1-h6**,避免干扰 `addHeadingIds` 对齐)。预览与导出共用。
- **B5 音视频嵌入**:`embedMediaTags` 渲染后处理,`<img>` src 以 mp4/webm/mov/m4v 结尾 → `<video controls>`,mp3/wav/ogg/m4a/flac/aac → `<audio controls>`;置于图片包装之前。预览与导出共用。

### 阶段 C — 视觉美化 ✅
- h1 改主题强调色短下划线(去全宽粗边),h2 细线,标题层级字号精修;h1-h6 统一 `--ink-md-heading-color`。
- **标题 hover 锚点**:`addHeadingIds` 注入 `#` 锚点链接,hover 浮现,点击复制 `#slug`(剪贴板不可用降级为滚动定位);导出物中作为普通锚点可跳转。
- 引用块 3px 侧条 + 圆角 8px;表格圆角 8px + 表头字距;图片圆角 8px。
- **图注**:`md.renderer.rules.image` 覆写,`![alt](src "title")` 的 title → `ink-figure` + caption(span 结构保证 `<p>` 内合法)。
- 补齐缺失元素样式:`kbd` 键帽、`mark`、`details/summary` 折叠块、脚注回链、`.footnotes-sep`、KaTeX display 溢出裁剪。
- **交互样式迁移**:`ink-codeblock`/`ink-table`/图片工具栏/TOC 的 `:deep` 样式全部迁入 `markdown-body.css` 并变量化(顺带修复 `.dark :deep()` 永不匹配的暗色变体失效问题);导出物同步获得 TOC/代码块底样式。

### 阶段 D — 阅读体验 ✅
- **D1 `SettingsModal.vue`**:正文字体(跟随主题/无衬线/衬线)、字号(跟随/14/15/16/18/20)、内容行宽(跟随/720/820/1000)、代码高亮主题(auto + 7 款)。全部通过在 `<html>` 上**内联写 CSS 变量**实现用户级覆盖(同元素内联 > 主题规则);持久化 localStorage(`readerFont`/`readerFontSize`/`readerWidth`/`hljsTheme`)。入口:工具栏齿轮按钮 + `Ctrl+,` + 原生菜单「视图 → 阅读偏好」(Rust 仅加一个 `MenuItem::with_id`)。
- **D2 `Lightbox.vue`**:点击预览图片打开灯箱(工具栏点击除外),滚轮/按钮缩放 20%-500%,`Esc`/点击遮罩关闭,`+`/`-` 快捷缩放。
- **D3 阅读进度条**:`EditorPane.vue` 预览面板顶部 3px 进度条(轨道 + 强调色填充,占独立布局空间不遮挡内容),纯预览与分栏模式均生效,颜色取 `--ink-md-accent`。
- **导出同步**:`captureCurrentTheme` 扩展 `readerCss` + 按所选 hljs 主题输出,导出 HTML/PDF 与预览观感一致。

### 阶段 E — 修复与性能 ✅
- **导出 TOC 锚点修复**:`renderHTMLForExport` 补调 `addHeadingIds`,导出 HTML/PDF 中目录/锚点恢复跳转。
- **输入防抖**:`renderedHTML` 改读 250ms 防抖的 `renderContent`(切换 tab 立即同步不走防抖),大幅降低击键时全量重渲染开销。
- **死依赖清理**:卸载 `html2canvas`、`jspdf`(零引用)。

### 阶段 F — 实测回归修复 + 代码质量收尾 ✅

dev 实跑发现并修复的三个回归,以及一轮全库代码审查优化:

**回归修复**
- **分栏滚动同步抖动**:同步锁的解锁定时器每次同步都新起且从不清除,连续滚动时旧定时器提前解锁、程序化滚动的回声事件漏过防线,双向回写造成抖动;改为全局唯一可重置定时器(`holdSyncLock`,100ms)。
- **阅读进度条遮挡正文**:原为滚动容器内 sticky 悬浮 + 负 margin,叠在内容上;重构为预览面板顶部的独立布局条(灰轨道 + 强调色填充),内容零遮挡。
- **"选中 N 字"统计错位**:实测发现 WebView2 中 textarea 选区**不触发 document 级 `selectionchange`**,旧实现只统计到编辑器之外的选区(如标签栏文字);改挂 textarea 元素级事件按 `selectionStart/End` 计数,document 级监听仅负责把非编辑器选区清零。

**代码质量**
- **渲染管线单源化**:预览与导出各自维护的 mermaid 占位/KaTeX 暂存/锚点注入合并为 `src/utils/markdown.ts` 的同一条 `renderMarkdownHTML` 管线,消灭第二对漂移副本。
- **导出/打印抽离 `useExport.ts`**:两处重复的 HTML head + mermaid 初始化脚本合并;`captureCurrentTheme` 改 `getComputedStyle` 读实时主题值,删除与 style.css 平行的手抄色表。
- **组件/常量抽离**:欢迎文档 → `constants/defaultContent.ts`,主题/高亮/字体选项 → `constants/options.ts`,快捷键清单内聚进 `ShortcutsModal.vue`,EditorPane 双 textarea 抽为 `EditorTextarea.vue`;App.vue 3127 → 2145 行。
- **性能**:大纲 `headings`/词数改读防抖副本(原每次击键 O(N×H) 全文扫描);搜索 200ms 防抖;mermaid 按「主题+源码」增量渲染跳过未变更图;脆弱的内联 style 选择器换 `getVisibleEditor()`。
- **死代码/死样式**:`AppConfig` 类型、useWorkspace 12 个无消费导出、`PRINT_CSS` 旧结构选择器、失效 favicon、永不匹配的 scoped katex/滚动条样式;`.katex-error` 样式缺失(公式报错裸奔)顺势按主题变量补进 markdown-body.css;TheToolbar 匿名监听器泄漏、Lightbox 常驻键盘监听、PrintHint 重复声明、markdown-body.css 重复行规则一并清理。
- **界面**:侧边栏四个模式按钮 emoji → lucide 线性图标,与工具栏风格统一;全局细滚动条在清理后真正作用于编辑器/预览区。

## 五、回归测试清单(dev 实跑必过)

1. 四套主题 × 亮/暗:预览观感正常,无"白底暗 token"代码块错配
2. 新语法全通过:`> [!NOTE]` 等五种提示块、`==高亮==`、`^上标^`、`~下标~`、front-matter 元信息卡、`![](x.mp4)`/`.mp3` 播放器
3. front-matter 守卫:正文以 `---` 开头但不构成合法 YAML 时按普通内容渲染
4. 标题 hover 出现 `#`,点击复制锚点;`[[toc]]` 预览点击跳转正常
5. `![alt](src "title")` 渲染图注;点击图片打开灯箱,Esc 关闭;图片悬浮工具栏缩放/对齐仍正常
6. 设置面板:字体/字号/行宽/高亮主题即换即生效,重启后保留;分栏与纯预览模式同时生效
7. 导出 HTML:打开后与预览观感一致(含阅读偏好),`[[toc]]`/锚点可跳转,提示块/图注/元信息卡带样式
8. 导出 PDF(打印):mermaid 渲染完成再打印,分页正常
9. 打字流畅度:长文档连续击键预览 250ms 内合并更新;切换 tab 预览立即刷新
10. 原有链路不回归:图片 `asset://` 本地化、代码块复制/行号、表格可视化编辑、任务列表、脚注、KaTeX、mermaid 亮暗主题联动、单实例打开文件

## 六、关键风险与对策

| 风险 | 对策 |
|---|---|
| CSS 变量改造导致主题观感回归 | 变量值逐一取自原硬编码颜色;`typora` 等少量非颜色规则(标题字重/斜体引用)保留为独立小节 |
| 阅读偏好内联变量 vs 主题变量冲突 | 同元素(html)上内联 style 恒胜出语义正确;"跟随主题"档不写内联属性 |
| `addHeadingIds` 按序对齐假设(front-matter 卡含标题会错位) | 元信息卡内部禁用 h1-h6,只用 div/span |
| hljs `lib/common` 缺生僻语言高亮 | 未注册语言走既有 `escapeHtml` 兜底,后续可按需 `registerLanguage` |
| 防抖期间 TOC/锚点与正文短暂不一致 | 仅过渡态 250ms,tab 切换即时不走防抖;既有 TOC 重复标题 dedup 缺口另行记录 |
| `:deep` 迁移后交互样式作用于全局 | 选择器均带 `.markdown-body` 前缀,只影响预览内容 |

## 七、范围外(留后续版本)

- localStorage → tauri-plugin-store 设置迁移(V1.5.0 遗留)
- App.vue 继续拆分(V1.6.0 已抽出渲染管线 `utils/markdown.ts` 与导出 `useExport.ts`;侧边栏视图/搜索替换仍留在 App.vue)
- emoji 短代码(`:smile:`)
- 行号/锚点级精确滚动同步(现为整页比例映射)
- 原始 HTML 安全提示
- TOC 与 `addHeadingIds` 重复标题 slug 去重不一致(既有小缺陷,TOC 链接未做 `-2` 后缀去重)
