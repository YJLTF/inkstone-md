# InkStone MD V1.2.0 发布规划

> 目标:在 V1.1.0 "UI 现代化 + 导出保真" 的基础上,聚焦**阅读体验**与**编辑效率**。核心三件事:**Markdown 渲染样式全面美化**、**大纲/目录点击同步滚动到预览**、**编辑与预览视图滚动同步(默认开启)**。

## 一、版本基线

| 项 | 当前 | 目标 |
|---|---|---|
| `package.json` version | 1.1.0 | 1.2.0 |
| `src-tauri/Cargo.toml` version | 1.1.0 | 1.2.0 |
| `src-tauri/tauri.conf.json` version | 1.1.0 | 1.2.0 |
| 分支 | `release/v1.1.0`(已发布) | `release/v1.2.0`(本期) |
| Tag | `v1.1.0` 已存在 | `v1.2.0`(构建并自测通过后打) |

> 三处 version 必须**同步**改,缺一即 `tauri build` 失败。规则见 `AGENTS.md` "版本号必须三处同步"。

## 二、总体方向

| 主题 | 现状痛点 | V1.2.0 目标 |
|---|---|---|
| **A. 渲染样式美化** | 基础样式简陋,标题/段落/列表间距粗放,代码块/引用/表格缺少设计感;四主题差异仅停留在颜色,排版细节不到位 | 全面美化 `.markdown-body` 排版,优化标题层级、列表样式、段落节奏、代码块视觉、引用块设计;四主题各自完善排版细节 |
| **B. 大纲点击同步定位** | 侧边栏大纲点击只跳编辑器光标,预览视图不动;`[[toc]]` 点击也只动编辑器;用户想看对应预览位置还得手动滚 | 大纲/目录点击后,**编辑器和预览同步滚动**到对应位置,预览区 heading 短暂高亮提示 |
| **C. 滚动同步设置** | 分栏模式下两边各滚各的,长文对照编辑非常累 | 新增"滚动同步"开关,默认开启;编辑滚预览跟着滚,预览滚编辑跟着滚(双向);支持在设置里关闭 |

不做:
- 不引入新功能(如 DOCX/EPUB、拼写检查、表格回写 md),这些仍在 V1.x 后续候选。
- 不拆分 `App.vue` 组件化(沿用单文件约定,降低风险)。
- 不改 Tauri 后端命令(Rust 端零改动,本期纯前端优化)。
- 不做设置面板 UI 大改,滚动同步开关放工具栏或右键菜单(保持轻量)。

## 三、阶段 A · Markdown 渲染样式美化

### A1. 基础排版体系重构(优先级最高)

**目标**:从"能用"升级到"好读",建立统一的排版节奏(垂直韵律)。

**(1) 统一垂直间距(Vertical Rhythm)**
- 引入基准行高概念:正文 `line-height: 1.7`(inkstone/github),`1.75`(typora),`1.6`(onedark 代码主题)
- 所有块级元素(`h1-h6`/`p`/`ul`/`ol`/`pre`/`blockquote`/`table`/`hr`)的 `margin-top` / `margin-bottom` 按"基线网格"对齐,以 `1em` 为基础单位,避免零散的 `0.8em` / `1em` 混用
- 统一改为 `margin: 1.2em 0` 或 `1em 0`,按元素重要性分级

**(2) 标题层级优化**

当前问题:h1/h2 只有下边框,层级感弱;h3-h6 几乎没区别。

改进:
- **h1**:字号 `2em` → `2.25em`,字重 `700`,下边距 `0.8em`,底部边框 `2px`(当前 `1px`),内边距 `0.4em 0`
- **h2**:字号 `1.5em` → `1.65em`,字重 `600`,下边距 `0.7em`,底部边框 `1px`,内边距 `0.3em 0`
- **h3**:字号 `1.25em` → `1.35em`,字重 `600`,增加**左侧主题色竖条**(`3px` 宽,`1em` 高,与文字对齐),左边距 `-12px`,左内边距 `9px`
- **h4**:字号 `1.1em`,字重 `600`,颜色比正文稍深(或主题色弱化版)
- **h5 / h6**:字号 `1em`,字重 `600`,颜色用次级文本色
- 所有标题:增加 `letter-spacing: -0.01em` 优化大字间距;`scroll-margin-top: 80px`(为点击跳转时顶部预留空间)

**(3) 段落与正文**
- 段落 `margin` 从 `1em 0` 调整为 `1em 0 1.1em`,段间距略大于行高,阅读节奏更清晰
- 优化首行:**不**做首行缩进(技术文档惯例),但第一段在 h1/h2 后时上边距减半
- 行末标点悬挂(可选,如果实现成本低就做)

**(4) 列表样式美化**

当前问题:列表就是默认 ul/ol,符号与文字间距小,嵌套层级不明显。

改进:
- 无序列表:
  - 一级:实心圆点 `•`(用 `::before` 自定义,颜色用主题色或次级文本色),`padding-left` 从 `2em` → `1.6em`
  - 二级:空心圆圈 `◦`
  - 三级:实心方块 `▪`
- 有序列表:
  - 数字用 `list-style-type: decimal`,数字右对齐感
  - 增加 `li::marker` 颜色(次级文本色)
- `li` 间距从 `0.3em 0` → `0.4em 0`
- 列表内嵌段落/代码块/引用的缩进对齐修复

**(5) 代码块与行内代码**

当前问题:行内代码和代码块背景简单,缺少边界感。

改进:
- **行内代码**:
  - 背景从纯色改为"微渐变 + 细边框",或保持纯色但加 `1px` border(同色系稍深)
  - 圆角 `4px`(当前 `3px`)
  - 上下 padding 微调 `0.15em 0.4em`
  - 字号 `0.9em` → `0.88em`
- **代码块**:
  - 圆角 `6px` → `8px`
  - 增加 `1px` 边框(同色系,比背景深/浅 5-10%)
  - padding `1em` → `1.2em`
  - 增加顶部"条带"或右上角语言标签(从 `class="language-xxx"` 提取语言名,右上角小字显示)
  - 行号(如果已有行号支持):数字列背景稍深,文字更淡,宽度 `2.5em`
  - 复制按钮(已有):样式微调,hover 时背景变明显

**(6) 引用块设计**

当前问题:只有左边框 + 灰色文字,太朴素。

改进:
- 左边框从 `4px` → `4px`(保持),但颜色用**主题强调色**而非灰色(例如 inkstone 用蓝色系,github 保持灰色,onedark 用黄色,typora 用棕色)
- 背景色增加透明度,从 `rgba(127,127,127,0.04)` → `rgba(...,0.06)`
- 增加 `border-radius: 0 6px 6px 0`
- 文字颜色从"次级灰"改为"正文色 × 0.8 透明度",可读性更好
- 引用内的第一段落/最后段落 margin 收敛(避免双倍间距)
- typora 主题:保持 `font-style: italic`

**(7) 表格样式**

当前问题:基础边框 + 表头背景,缺少斑马纹或悬浮效果。

改进:
- 边框圆角:用 `border-collapse: separate` + `border-spacing: 0`,外层圆角 `6px`(技术上稍复杂,可用 `overflow: hidden` + 外层容器实现)
- 斑马纹:`tr:nth-child(even)` 背景加极淡底色(已有部分主题做了,全面铺开)
- 表头:字重 `600`,底部边框 `2px`(当前 `1px`)
- 单元格 padding 从 `0.5em 1em` → `0.6em 1em`
- Hover 效果:行 hover 时背景加深(可选,成本低就做)

**(8) 分割线 hr**
- 从 `border-top: 1px solid #ddd` 改为渐变或更细的样式
- 增加上下 margin `2em` → `2.5em`
- 或改为居中短横线 `• • •` 样式(可选,按主题决定)

**(9) 链接样式**
- 增加 `text-underline-offset: 2px`
- hover 时颜色加深 + 下划线从 `solid` 变虚线或反之
- 链接颜色与主题强调色统一

### A2. 四主题各自完善

**目标**:四个主题不仅颜色不同,排版气质也有差异。

| 主题 | 优化方向 |
|---|---|
| **InkStone**(默认) | 现代简洁,蓝色系强调色;标题用系统无衬线;代码块用 Cascadia Code;整体偏 VS Code 风格 |
| **GitHub** | 严格对齐 github.com 渲染效果;字体栈与 GitHub 一致;细节向 GitHub Markdown 看齐 |
| **One Dark** | 代码编辑器风格;等宽字体栈;标题用金黄色(已有);行高稍紧 `1.6`;代码块占视觉中心 |
| **Typora** | 暖白衬线,阅读友好;标题层级更圆润;行高 `1.75`;max-width `760px`(已有);引用保持斜体 |

### A3. 其他元素美化

- **任务列表**(`- [ ] / - [x]`):checkbox 样式自定义,与主题色统一,圆角,checked 状态有对勾动画
- **脚注**(markdown-it-footnote):上标样式优化,脚注区样式统一
- **KaTeX 公式**:行内公式垂直对齐优化,块级公式左右 padding
- **Mermaid 图表**:容器背景/边框优化,与代码块风格统一
- **图片**:圆角从 `4px` → `6px`,增加 `box-shadow: 0 1px 3px rgba(0,0,0,0.1)`(浅色主题),暗色主题加淡边框

### A4. 不在本期做

- 自定义主题编辑器
- 字体/字号/行宽用户偏好设置
- 深色模式下的图片自动降亮

## 四、阶段 B · 大纲/目录点击同步滚动定位

### B1. 给预览区 heading 加 id 锚点

**现状**:markdown-it 渲染的 `<h1>-<h6>` 没有 `id` 属性,导致无法用 `scrollIntoView` 定位。

**方案**:
- 新增 `addHeadingIds(html: string): string` 函数,在 `md.render` 之后、其他包装之前,用正则给所有 `<h1>-<h6>` 注入 `id="slug-text"`
- `slug` 算法复用现有的 `slugify()` 函数(已定义在 [App.vue](file:///workspace/src/App.vue#L677-L684))
- 处理重名:如果出现相同 slug,追加 `-2` / `-3` 后缀
- 给 heading 同时加 `class="ink-heading"`,方便后续高亮和选择器使用

**注入位置**:在 `renderedHTML` computed 中,`md.render(pre2)` 之后、公式替换之前调用。

### B2. 改造 jumpToHeading 为双向同步

**现状**:`jumpToHeading(line: number)`(在 [App.vue](file:///workspace/src/App.vue#L1846-L1858))只处理编辑器,不动预览。

**改造**:`jumpToHeading` 重命名或扩展为 `navigateToHeading(line: number)`:
1. 保持原编辑器光标定位逻辑
2. **新增预览区滚动**:通过 line 找到对应的 heading 文本 → 计算 slug → 在预览区找 `#slug` → `scrollIntoView({ behavior: 'smooth', block: 'start' })`
3. 短暂高亮:给目标 heading 加一个 `ink-heading-highlight` 类,2 秒后移除,用 CSS transition 做淡入淡出

**平滑滚动**:
- 预览区容器 `.preview-area` 加 `scroll-behavior: smooth`
- 考虑到 `scrollIntoView` 是滚父容器,需要用 `block: 'center'` 或 `block: 'start'` + `scroll-margin-top`(A1 中已加)

### B3. 侧边栏大纲点击

**现状**:`@click="jumpToHeading(heading.line)"`(在 [App.vue](file:///workspace/src/App.vue#L3035))。

**改动**:
- 调用上面改好的 `navigateToHeading(heading.line)` 即可,一行改动
- 增加"当前阅读位置"高亮:滚动时反向计算当前可见的 heading,在侧边栏大纲中给对应项加 `active` 类(背景色/左边框)

### B4. `[[toc]]` 点击同步

**现状**:`bindTocNavigation`(在 [App.vue](file:///workspace/src/App.vue#L1037-L1055))里点击 TOC 链接最终调 `jumpToHeading(i + 1)`。

**改动**:
- 替换为调用 `navigateToHeading(i + 1)`,自动获得双向同步
- 由于预览区内的 TOC 链接点击本身就在预览区,`scrollIntoView` 可能更直接;但统一走 `navigateToHeading` 保证编辑器也同步

### B5. 滚动时反向高亮大纲(可选加分项)

**目标**:用户滚动预览区时,侧边栏大纲自动高亮当前位置的标题。

**实现思路**:
- 监听预览区 `scroll` 事件(节流,`requestAnimationFrame` 或 `setTimeout` 100ms)
- 用 `IntersectionObserver` 或遍历所有 `.ink-heading` 找到 `getBoundingClientRect().top < 100` 的最末一个
- 更新 `activeHeadingIndex` ref
- 侧边栏大纲对应项加 `active` 类(左边框 + 文字加粗/变色)
- 编辑器侧的滚动也可以反过来驱动(根据光标行找最近 heading)

> 本期建议做"预览滚动 → 大纲高亮",编辑器滚动反向驱动可以不做(光标位置不等于阅读位置)。

## 五、阶段 C · 编辑与预览视图滚动同步

### C1. 核心设计

**目标**:分栏模式下,一边滚动另一边按比例跟随;用户可一键开关。

**(1) 同步策略**
- 采用**比例同步**:根据 `scrollTop / (scrollHeight - clientHeight)` 的百分比同步
- 原因:编辑器和预览的行高/内容高度不可能完全一致,按行号同步误差大;比例同步简单可靠,体验接近 Typora / VS Code
- 双向同步:编辑器滚带动预览,预览滚带动编辑器

**(2) 防止循环抖动**
- 问题:A 滚带动 B 滚,B 滚的事件又会触发 A 滚,形成死循环
- 方案:用一个 `isSyncing` 标志位 + `setTimeout` 延迟清除;或者记录"本次滚动是由同步触发的"就跳过反向同步
- 具体实现:
  ```
  let syncingFrom: 'editor' | 'preview' | null = null;
  编辑器scroll:
    if (syncingFrom === 'preview') return;
    syncingFrom = 'editor';
    计算比例 → 设置预览scrollTop;
    setTimeout(() => syncingFrom = null, 100);
  预览scroll同理
  ```

### C2. 设置项存储与默认值

- 新增 `scrollSync = ref(localStorage.getItem('scrollSync') !== 'false')` —— **默认开启**
- 持久化到 `localStorage`
- 关闭时 `scrollSync.value = false`,两边互不影响

### C3. UI 开关放哪里

**选项分析**:
1. 工具栏加一个按钮(图标用 `Link` 或 `Columns2` 的变体)——占位置,但最直观
2. 状态栏加一个 toggle 指示(类似打字机模式)——不占工具栏位置,符合现有模式
3. 右键菜单 —— 隐藏太深

**推荐方案**:状态栏右侧加一个"🔗 滚动同步"的指示标签,点击切换,类似打字机模式的 `⌨️ 打字` 标签(见 [App.vue](file:///workspace/src/App.vue#L3190))。
- 开启时显示 `🔗 同步`(蓝色),关闭时显示 `🔗 已暂停`(灰色)
- 点击切换,tooltip 提示"滚动同步 (F7)"
- 增加快捷键 `F7` 切换(与 F8 专注 / F9 打字机一脉相承)

### C4. 实现细节

**(1) 绑定滚动事件**
- 在 `onMounted` 里给编辑器 textarea 和预览区容器加 `scroll` 监听
- 注意:分栏模式下有两套 textarea 和 preview-area(单栏模式/分栏模式各一组),需要用 `document.querySelectorAll` 找到当前可见的那组
- 或者用事件委托,监听父容器

**(2) 节流**
- 滚动事件触发频繁,用 `requestAnimationFrame` 节流,保证 60fps
- 或者简单 `setTimeout` + 标志位

**(3) 切换模式时的处理**
- 从单栏切到分栏:立即同步一次两边位置(按编辑器当前位置计算比例,设预览的 scrollTop)
- 从分栏切到单栏:不做特殊处理

**(4) 与大纲跳转的协作**
- 大纲跳转(`navigateToHeading`)时,如果滚动同步开启,两边都跳到对应位置——这本来就是 B 阶段的目标
- 跳转时临时禁用滚动同步的事件监听(或设 `syncingFrom` 标志),避免跳转过程中互相触发

### C5. 不在本期做

- 按行号精确同步(需要 sourcemap,复杂度高)
- 同步灵敏度调节滑块
- 不同步代码块/图片等特殊区域的智能对齐

## 六、关键文件与改动落点

| 文件 | 改动概要 |
|---|---|
| `package.json` | version → 1.2.0(无新依赖) |
| `src-tauri/Cargo.toml` | version → 1.2.0(无 Rust 改动) |
| `src-tauri/tauri.conf.json` | version → 1.2.0 |
| `src/style.css` | 大幅扩展 `.markdown-body` 样式;四主题排版细化;新增 heading 高亮动画、滚动平滑 |
| `src/App.vue` | 新增 `addHeadingIds` / `navigateToHeading` / 滚动同步逻辑;改造 `jumpToHeading`;新增 `scrollSync` ref + 状态栏开关 + F7 快捷键;大纲 active 高亮 |
| `README.md` / `README_EN.md` | 特性章节更新:样式美化、滚动同步、大纲同步定位 |

> **不**新增组件文件,继续单文件约定。本期改动全部在前端,Rust 端零改动。

## 七、开发顺序建议

建议按 A → B → C 的顺序开发,每阶段独立可验证:

1. **Phase 1**:样式美化(A1-A3)
   - 改 CSS,跑 `npm run dev` 肉眼验收
   - 风险最低,先做

2. **Phase 2**:大纲同步定位(B1-B4)
   - 先加 heading id → 改 jumpToHeading → 验证点击跳转
   - 再做大纲反向高亮(B5,可选)

3. **Phase 3**:滚动同步(C1-C4)
   - 先实现比例同步 + 防抖动 → 加开关 → 加快捷键
   - 最后联调:大纲跳转 + 滚动同步 一起工作是否流畅

## 八、自测用例

### A. 样式美化
- [ ] 四个主题(inkstone/github/onedark/typora)下,标题层级清晰,h1-h6 可明显区分
- [ ] 列表(ul/ol)嵌套层级分明,符号/数字与文字间距舒适
- [ ] 代码块有边框 + 圆角 + 语言标签(如做了),行内代码样式精致
- [ ] 引用块有左边框 + 背景 + 圆角,颜色与主题呼应
- [ ] 表格有斑马纹 + 表头加粗 + 圆角
- [ ] 图片有圆角 + 轻微阴影(浅色主题)
- [ ] 链接有下划线偏移,hover 有反馈
- [ ] 任务列表 checkbox 样式美观

### B. 大纲同步定位
- [ ] 侧边栏大纲点击 → 编辑器光标跳到对应行 + 预览区平滑滚动到对应 heading
- [ ] 目标 heading 有短暂高亮提示(2s 淡出)
- [ ] `[[toc]]` 目录点击 → 同上效果
- [ ] 滚动预览区 → 侧边栏大纲自动高亮当前位置(如做了 B5)
- [ ] 重名标题(两个相同文本的 h2)都能正确跳转,不跳错

### C. 滚动同步
- [ ] 分栏模式下,滚动编辑器 → 预览按比例跟随滚动
- [ ] 滚动预览 → 编辑器按比例跟随滚动
- [ ] 两边来回滚动不抖动、不循环触发
- [ ] 状态栏显示"🔗 同步",点击可切换为"🔗 已暂停"
- [ ] F7 快捷键可切换滚动同步
- [ ] 关闭同步后,两边独立滚动互不影响
- [ ] 从单栏切到分栏,预览位置立即与编辑器对齐
- [ ] 大纲跳转时两边都到位,不出现同步干扰

## 九、质量门

- [ ] `npm run build`(vue-tsc + vite)零错误
- [ ] `cargo check` 零错误(本期无 Rust 改动但仍跑一次)
- [ ] 真机打 NSIS 包并自测主要流程
- [ ] 关键流程录屏:打开长文档 → 滚动编辑器看同步 → 点大纲跳转 → 切换主题看样式 → 关闭同步
- [ ] README 同步更新(版本、特性、滚动同步说明)

## 十、发布 Checklist

- [ ] 三处 version → 1.2.0
- [ ] `ROADMAP_V1.2.0.md` 自测项全部勾完
- [ ] `npm run tauri build` 在 Win 10 / Win 11 各跑一次
- [ ] 验证 .md 文件关联仍正常(不应被本期影响)
- [ ] 打 tag:`git tag -a v1.2.0 -m "InkStone MD 1.2.0"` 并推 `origin`

## 十一、风险与回退

| 风险 | 缓解 |
|---|---|
| 样式改动过大导致某些边缘 markdown 渲染错位 | 分主题逐步验证;保留 V1.1.0 样式快照,出问题快速回退 |
| 滚动同步在长文档下卡顿 | 用 `requestAnimationFrame` 节流;必要时降级为 setTimeout 节流 |
| 滚动同步双向抖动/循环触发 | 严格的 `syncingFrom` 标志位 + 超时清除;自测时反复快速滚动验证 |
| heading id 重名导致跳转错位 | slug 后加序号;`addHeadingIds` 单测(手动构造重名用例) |
| `App.vue` 继续涨到 4000+ 行 | 接受。记入 V1.3 候选:拆出 `MarkdownRenderer.vue` / `Outline.vue` |

## 十二、不在本期范围(留 V1.3+ 候选)

- 设置面板 UI(统一管理所有偏好)
- 字体/字号/行宽用户偏好
- 代码块行号用户开关
- 自定义主题
- 拆分 `App.vue` 组件化
- 按行号精确滚动同步(sourcemap 级)
- DOCX / EPUB 导出
- 拼写检查
