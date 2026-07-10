# InkStone MD V1.3.0 发布规划

> 目标:在 V1.2.0 "阅读体验优化" 的基础上,做一轮**功能补全 + 体验修复型**迭代。聚焦用户反馈的四个具体问题:**补齐纯编辑模式**、**修复打字机模式失效**、**修复专注模式失效**、**原生菜单栏增加快捷键与关于**。本期不改渲染样式,不改导出链路,Rust 端仅做菜单扩展。

## 一、版本基线

| 项 | 当前 | 目标 |
|---|---|---|
| `package.json` version | 1.2.0 | 1.3.0 |
| `src-tauri/Cargo.toml` version | 1.2.0 | 1.3.0 |
| `src-tauri/tauri.conf.json` version | 1.2.0 | 1.3.0 |
| 分支 | `release/v1.2.0`(已发布) | `release/v1.3.0`(本期) |
| Tag | `v1.2.0` 已存在 | `v1.3.0`(构建并自测通过后打) |

> 三处 version 必须**同步**改,缺一即 `tauri build` 失败。规则见 `AGENTS.md` "版本号必须三处同步"。

## 二、总体方向

| # | 主题 | 现状痛点 | V1.3.0 目标 |
|---|---|---|---|
| 1 | **纯编辑模式缺失** | README 已声称"分栏 / 纯编辑 / 纯预览"三模式,但工具栏和原生菜单只能切分栏 / 预览,纯编辑模板块虽存在却无法触发 | 工具栏 + 原生菜单 + 快捷键三处都能切到纯编辑模式,三模式循环切换 |
| 2 | **打字机模式无效** | `toggleTypewriterMode` 只切 ref 存 localStorage,`scrollToCursor` 行高硬编码 20px(实际约 28.8px),算出的滚动位置错误,光标不会居中 | 修复行高测算,光标行真正垂直居中,打字 / 移动光标时实时跟随 |
| 3 | **专注模式无效** | `toggleFocusMode` 开启时无任何副作用,`.focus-mode` CSS 仅改 line-height 几乎不可感知,当前行高亮又太淡且行高错位 | 专注模式开启时淡化非当前段落、强化当前行高亮,有肉眼可见的视觉聚焦 |
| 4 | **菜单栏缺快捷键与关于** | 原生菜单只有 文件 / 编辑 / 视图,没有"快捷键"说明入口,也没有"关于" | 新增"帮助"子菜单,含"快捷键"和"关于 InkStone MD",前端弹对应对话框 |

不做:
- 不引入新功能(DOCX/EPUB、拼写检查、设置面板等仍在 V1.x 后续候选)。
- 不拆分 `App.vue` 组件化(沿用单文件约定,降低风险)。
- 不改渲染样式与导出链路(V1.2.0 已完成,本期不动)。
- 不改文件关联 / 单实例 / 图片本地化等已稳定链路。

## 三、任务 1 · 补齐纯编辑模式

### 1.1 现状与根因

- 模板里**已存在**纯编辑块([App.vue:3382](file:///workspace/src/App.vue#L3382)):`<div v-show="!showPreview && !showSplit">`,内含独立 textarea。即当 `showPreview=false` 且 `showSplit=false` 时本应显示纯编辑器。
- 但**没有任何控件**能把这两个 ref 同时置为 false:
  - 工具栏只有两个按钮:分栏(`showSplit=true; showPreview=false`)、预览(`showPreview=true; showSplit=false`),见 [App.vue:3049-3063](file:///workspace/src/App.vue#L3049)。
  - 原生菜单只有"分栏视图"和"预览模式",见 [lib.rs:376-377](file:///workspace/src-tauri/src/lib.rs#L376)。
  - 菜单事件处理([App.vue:2768-2775](file:///workspace/src/App.vue#L2768))同样只覆盖 split / preview。
- README 已写"多模式实时预览:分栏 / 纯编辑 / 纯预览"([README.md:13](file:///workspace/README.md#L13))与"`Ctrl+滚轮` 切换分栏 / 纯编辑 / 纯预览"([README.md:66](file:///workspace/README.md#L66))→ **文档与实现不符**,本期补齐。

### 1.2 修复方案

**(1) 引入统一视图模式枚举(推荐)**

当前用两个布尔 ref 组合表达三态,易出错(可能出现两个都 true 的非法态)。改为单一 `viewMode` ref:

```ts
type ViewMode = 'edit' | 'split' | 'preview';
const viewMode = ref<ViewMode>(localStorage.getItem('viewMode') || 'split');
```

- 派生 `showSplit = computed(() => viewMode.value === 'split')`、`showPreview = computed(() => viewMode.value === 'preview')`,保持模板 `v-show` 不用大改;纯编辑态 `!showSplit && !showPreview` 自然成立。
- 持久化到 `localStorage('viewMode')`。
- 切换函数 `setViewMode(mode: ViewMode)`,切换到 split 时 `nextTick(syncPreviewFromEditor)` 对齐位置(沿用 V1.2.0 逻辑)。

> 若不想动现有布尔 ref,也可直接加一个"编辑模式"按钮把两个 ref 都置 false;但枚举更清晰,且能根除非法组合。**推荐枚举方案**。

**(2) 工具栏加"编辑模式"按钮**

在 [App.vue:3047-3064](file:///workspace/src/App.vue#L3047) 的视图按钮组,在"分栏"按钮前加一个编辑按钮:

```html
<button @click="setViewMode('edit')" class="toolbar-btn"
        :class="{ active: viewMode === 'edit' }" title="编辑视图 (Ctrl+\\)">
  <Pencil :size="16" />
</button>
<button @click="setViewMode('split')" class="toolbar-btn"
        :class="{ active: viewMode === 'split' }" title="分栏视图">
  <Columns2 :size="16" />
</button>
<button @click="setViewMode('preview')" class="toolbar-btn"
        :class="{ active: viewMode === 'preview' }" title="预览视图">
  <Eye :size="16" />
</button>
```

图标用 Lucide `Pencil`(已在用 `@lucide/vue`)。

**(3) 原生菜单加"编辑模式"项**

[lib.rs:370-380](file:///workspace/src-tauri/src/lib.rs#L370) 的"视图"子菜单,在"分栏视图"前加:

```rust
&MenuItem::with_id(app, "edit", "编辑模式\tCtrl+\\", true, None::<&str>)?,
&MenuItem::with_id(app, "split", "分栏视图", true, None::<&str>)?,
&MenuItem::with_id(app, "preview", "预览模式", true, None::<&str>)?,
```

前端菜单事件处理([App.vue:2768](file:///workspace/src/App.vue#L2768))增加:

```ts
case "edit": setViewMode('edit'); break;
case "split": setViewMode('split'); break;
case "preview": setViewMode('preview'); break;
```

**(4) 快捷键 `Ctrl+\` 循环切换**

在 [App.vue:2797](file:///workspace/src/App.vue#L2797) 的 keydown 监听里加:

```ts
if (e.ctrlKey && e.key === '\\') {
  e.preventDefault();
  const order: ViewMode[] = ['edit', 'split', 'preview'];
  const idx = order.indexOf(viewMode.value);
  setViewMode(order[(idx + 1) % order.length]);
}
```

> 不做 README 早期声称的 `Ctrl+滚轮` 切换(滚轮与字号缩放语义冲突,易误触),改为 `Ctrl+\` 循环;README 同步更正。

**(5) 打印 / 导出兼容**

- `exportPDF`([App.vue:2336](file:///workspace/src/App.vue#L2336))里 `showSplit=false; showPreview=true` 改为 `setViewMode('preview')`,逻辑等价但走统一入口。
- 滚动同步 `syncPreviewFromEditor` / `syncEditorFromPreview` 依赖 `showSplit` 的判断,改用 `viewMode.value === 'split'`,行为不变。

### 1.3 自测用例

- [ ] 工具栏点"编辑模式" → 只显示编辑器,无预览;按钮高亮。
- [ ] 原生菜单"视图 → 编辑模式" → 同上。
- [ ] `Ctrl+\` 在 编辑 → 分栏 → 预览 → 编辑 之间循环。
- [ ] 三模式间切换不出现"两个都显示"或"两个都不显示(空白)"的非法态。
- [ ] 切到编辑模式后 F7 滚动同步自动停用(仅 split 生效)。
- [ ] 编辑模式下打字机 / 专注模式仍生效(只对编辑器)。
- [ ] 导出 PDF 仍能正常切到预览并打印。
- [ ] 重启应用,上次的视图模式被恢复。

## 四、任务 2 · 修复打字机模式

### 2.1 现状与根因

- `toggleTypewriterMode`([App.vue:2388](file:///workspace/src/App.vue#L2388))只切换 ref + 存 localStorage,**本身无任何副作用**——这没问题,真正的效果在 `scrollToCursor` 里。
- `scrollToCursor`([App.vue:2487](file:///workspace/src/App.vue#L2487))确实在 `selectionchange` 时被调用([App.vue:2842](file:///workspace/src/App.vue#L2842)),但**算出的滚动位置是错的**:
  - 行高硬编码 `lineHeight = 20`([App.vue:2498](file:///workspace/src/App.vue#L2498)),而编辑器实际 `line-height: 1.8`、字号 16px → 真实行高约 **28.8px**。20 与 28.8 差 44%,导致 `cursorTop` 严重偏小,`scrollTo` 让光标停在视口偏上而非中央。
  - 用 `(lineNumber - 1) * lineHeight` 近似光标垂直位置,对**自动换行的长行**(一行 markdown 渲染成多视觉行)误差累积更大,光标可能滚出视口。
- 结果:状态栏"⌨️ 打字机"标记亮了,但光标实际没有居中 → 用户"看不到效果"。

### 2.2 修复方案

**(1) 用真实行高,不硬编码**

```ts
function scrollToCursor() {
  const textarea = getVisibleEditor();
  if (!textarea) return;
  const computed = getComputedStyle(textarea);
  const lineHeight = parseFloat(computed.lineHeight) || 28.8; // 兜底
  // ...
}
```

> 复用任务 1 新增的 `getVisibleEditor()`(已存在于 [App.vue:2403](file:///workspace/src/App.vue#L2403)),替代当前 `document.querySelector('.editor-input:not([style*="display: none"])')` 的脆弱写法。

**(2) 用 textarea 原生 API 精确定位(更稳)**

`lineNumber * lineHeight` 对自动换行长行不可靠。改用 `scrollTop` + `selectionStart` 的像素测量:

```ts
// 方案 A:复制一个隐藏的镜像 div 测真实像素高度(最准,但稍重)
// 方案 B:用 scrollHeight + 比例估算(简单)
const before = textarea.value.substring(0, textarea.selectionStart);
const ratio = before.length / textarea.value.length;
const targetTop = ratio * (textarea.scrollHeight - textarea.clientHeight);
textarea.scrollTop = Math.max(0, targetTop - textarea.clientHeight / 2 + lineHeight / 2);
```

> 推荐方案 B(按字符比例 + 居中偏移),实现简单且对长行容错好;若验收发现偏移明显,再升级为镜像 div 方案。

**(3) 触发时机补全**

当前只监听 `selectionchange`。补充:
- 切换打字机模式**开启的瞬间**立即居中一次(`toggleTypewriterMode` 末尾 `nextTick(scrollToCursor)`)。
- 切换视图模式(进 / 出分栏)后,若打字机开启,重新居中。
- `handleInput`(打字)后光标移动,`selectionchange` 会触发,已覆盖;但保险起见在 input 后也调一次。

**(4) 仅在编辑器可见时生效**

`scrollToCursor` 开头判断 `viewMode.value !== 'preview'`(预览模式无编辑器,不应滚动)。当前 `getVisibleEditor()` 返回 null 时已 return,够用。

### 2.3 自测用例

- [ ] 开启打字机模式 → 当前光标行立即滚动到编辑器垂直中央。
- [ ] 持续打字 → 光标始终保持在中央,不会跑到视口底部。
- [ ] 用方向键上下移动光标 → 编辑器自动滚动跟随,光标行居中。
- [ ] 长行(自动换行成 3+ 视觉行)下,光标仍大致居中,不跑出视口。
- [ ] 分栏 / 纯编辑模式下都生效;预览模式下不报错(无编辑器)。
- [ ] 关闭打字机模式 → 滚动行为恢复正常。
- [ ] 重启应用,打字机模式状态恢复且立即居中。

## 五、任务 3 · 修复专注模式

### 5.1 现状与根因

- `toggleFocusMode`([App.vue:2376](file:///workspace/src/App.vue#L2376))开启时**什么都不做**,仅关闭时清 textarea 背景。
- `.focus-mode` CSS([App.vue:3900](file:///workspace/src/App.vue#L3900))只改 `line-height: 1.8` + 隐藏 placeholder → 视觉上几乎不可感知(line-height 本来就接近 1.8)。
- `updateCurrentLine`([App.vue:2511](file:///workspace/src/App.vue#L2511))在 focusMode 时给当前行加渐变高亮,但:
  - 行高硬编码 `28`([App.vue:2519](file:///workspace/src/App.vue#L2519)),与实际 28.8px 接近但有偏差,且自动换行长行会错位。
  - 高亮颜色 `rgba(59, 130, 246, 0.1)` 太淡,且通过 `textarea.style.background` 内联设置,会被 `.editor-input` / `.dark .editor-input` 的背景盖住(后者有 `background: #1f2937`)→ 暗色下高亮几乎看不到。
  - **没有**"淡化非当前段落"的真正专注效果(Typora 专注模式是淡化当前段落之外的文字)。
- 结果:状态栏"🎯 专注"标记亮了,但视觉上几乎无变化 → 用户"看不到效果"。

### 5.2 修复方案

专注模式应有**肉眼可见的聚焦感**。采用"当前段落高亮 + 其余段落淡化"的经典做法。

**(1) 段落级而非行级聚焦**

textarea 是纯文本控件,无法对"段落"单独加样式。可行策略:

- **方案 A(推荐):当前行高亮 + 整体降低对比**。开启专注模式时:
  - 编辑器背景改用更柔和的色调(浅色主题微暗、深色主题微亮),降低环境对比;
  - 当前行用**明显高于环境的高亮条**(主题色 rgba 0.15~0.2),且用 CSS 变量随主题变;
  - 行高测算改用真实 `lineHeight`(同任务 2)。
- **方案 B(更接近 Typora):编辑器叠加遮罩**。在 textarea 上方放一层 `pointer-events: none` 的 div,用 `linear-gradient` 在当前行位置开一个透明"窗口",上下用半透明黑/白遮罩。技术上可行但维护成本高,且 textarea 滚动时要同步遮罩位置。

> 本期采用**方案 A**(简单、稳),把当前行高亮做明显即可;方案 B 列入 V1.4 候选。

**(2) 修复 `updateCurrentLine`**

- 行高改用真实值:`const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 28.8;`
- 高亮强度提升:浅色 `rgba(59,130,246,0.18)`,深色 `rgba(96,165,250,0.22)`;通过 `:root` CSS 变量 `--focus-line-bg` 注入,内联 style 引用变量。
- 内联 `background` 要确保盖过 `.editor-input` 的背景:用 `textarea.style.setProperty('background', ...)` 且不与 `box-shadow` 冲突(高亮走 background,聚焦框走 box-shadow,互不干扰)。
- 关闭时清背景的逻辑保留([App.vue:2379-2384](file:///workspace/src/App.vue#L2379))。

**(3) `toggleFocusMode` 开启时立即应用**

```ts
function toggleFocusMode() {
  focusMode.value = !focusMode.value;
  if (focusMode.value) {
    nextTick(updateCurrentLine); // 立即高亮当前行
  } else {
    // 清背景(已有逻辑)
    document.querySelectorAll('.editor-input').forEach((ta) => {
      (ta as HTMLTextAreaElement).style.background = '';
    });
  }
}
```

**(4) 触发时机补全**

当前 `updateCurrentLine` 只在 `selectionchange` 且 `focusMode` 为真时调([App.vue:2838](file:///workspace/src/App.vue#L2838))。补充:
- 切换视图模式后(进/出分栏,textarea 实例变化)重新高亮。
- 打字后(input 触发光标移动)重新高亮——`selectionchange` 已覆盖,但保险加一次。

**(5) 可选:隐藏干扰元素**

专注模式可顺带隐藏侧边栏 / 大纲,让编辑区最大化(更贴近"专注"语义)。但隐藏侧边栏可能与用户意图冲突,本期**不做强制隐藏**,仅在状态栏已有标记即可;若要隐藏,改为可选(后续偏好设置)。

### 5.3 自测用例

- [ ] 开启专注模式 → 当前行立即出现明显高亮条(浅/深主题都清晰可见)。
- [ ] 上下移动光标 → 高亮条跟随当前行,不错位。
- [ ] 长行(自动换行)下,高亮条对齐当前视觉行(允许按逻辑行高亮,不要求像素级)。
- [ ] 暗色主题下高亮条清晰可见(不被 `#1f2937` 背景盖住)。
- [ ] 关闭专注模式 → 高亮条消失,背景恢复正常。
- [ ] 专注模式与打字机模式可同时开启,互不干扰。
- [ ] 切换视图模式(编辑/分栏)后,专注高亮仍正确应用在新可见的 textarea 上。

## 六、任务 4 · 原生菜单栏增加快捷键与关于

### 6.1 现状与根因

- 原生菜单([lib.rs:348-382](file:///workspace/src-tauri/src/lib.rs#L348))只有 文件 / 编辑 / 视图 三个子菜单,无"帮助"菜单。
- 没有"快捷键"说明入口 → 用户只能翻 README 才能知道所有快捷键。
- 没有"关于"对话框 → 用户看不到版本号、作者、仓库地址等元信息。
- 菜单事件机制已就绪:`on_menu_event` 统一 `emit("menu-event", id)`([lib.rs:388-391](file:///workspace/src-tauri/src/lib.rs#L388)),前端 [App.vue:2749-2780](file:///workspace/src/App.vue#L2749) 已有 `listen("menu-event")` switch。本期只需加菜单项 + 前端 case + 两个对话框。

### 6.2 修复方案

**(1) Rust 端新增"帮助"子菜单**

[lib.rs:382](file:///workspace/src-tauri/src/lib.rs#L382) 的 `Menu::with_items` 增加 `help_menu`:

```rust
let help_menu = Submenu::with_items(
    app,
    "帮助",
    true,
    &[
        &MenuItem::with_id(app, "shortcuts", "快捷键\tF1", true, None::<&str>)?,
        &MenuItem::with_id(app, "about", "关于 InkStone MD", true, None::<&str>)?,
    ],
)?;

let menu = Menu::with_items(app, &[&file_menu, &edit_menu, &view_menu, &help_menu])?;
```

> `F1` 作为"快捷键说明"的快捷键(系统惯例,Win 下 F1 = 帮助)。`关于` 不绑快捷键,走菜单点击。

**(2) 前端菜单事件 case**

[App.vue:2768](file:///workspace/src/App.vue#L2768) switch 增加:

```ts
case "shortcuts": showShortcutsModal.value = true; break;
case "about": showAboutModal.value = true; break;
```

**(3) 快捷键 `F1` 直接触发**

[App.vue:2797](file:///workspace/src/App.vue#L2797) keydown 加:

```ts
if (e.key === "F1") {
  e.preventDefault();
  showShortcutsModal.value = true;
}
```

**(4) 快捷键对话框**

新增 `showShortcutsModal = ref(false)` + 一个 modal 组件(写在 App.vue 模板内,沿用单文件约定)。内容以分组表格列出全部快捷键,数据源与 README 快捷键表保持一致:

| 分组 | 快捷键 | 功能 |
|---|---|---|
| 文件 | `Ctrl+N` | 新建 |
| 文件 | `Ctrl+O` | 打开 |
| 文件 | `Ctrl+S` | 保存 |
| 文件 | `Ctrl+Shift+S` | 另存为 |
| 编辑 | `Ctrl+F` | 搜索替换 |
| 编辑 | `Ctrl+Z` / `Ctrl+Y` | 撤销 / 重做 |
| 视图 | `Ctrl+B` | 切换侧边栏 |
| 视图 | `Ctrl+\` | 循环切换 编辑/分栏/预览 |
| 视图 | `F7` | 滚动同步 |
| 视图 | `F8` | 专注模式 |
| 视图 | `F9` | 打字机模式 |
| 帮助 | `F1` | 快捷键说明 |
| 其他 | `Esc` | 关闭搜索/对话框 |

> 建议把这份快捷键清单抽成一个 `SHORTCUTS` 常量数组,对话框和 README 都引用同一份(README 手动同步,但代码内单一数据源)。

**(5) 关于对话框**

新增 `showAboutModal = ref(false)` + modal。内容:

- 应用名:**InkStone MD**
- 版本:`1.3.0`(从 `package.json` 注入,或硬编码同步)
- 简介:轻量优雅的桌面 Markdown 编辑器
- 技术栈:Tauri 2 + Vue 3
- 许可证:GPL-3.0
- 仓库链接(如有)

> 版本号从 Vite 的 `define` 注入(读 `package.json` version),避免三处 version 之外再多一处手改。简单做法:在 `vite.config.ts` 加 `define: { __APP_VERSION__: JSON.stringify(pkg.version) }`,前端 `const appVersion = __APP_VERSION__`。

**(6) Modal 通用样式**

两个对话框复用同一套 modal 样式(遮罩 + 居中卡片 + Esc/点遮罩关闭 + 标题栏关闭按钮),沿用项目现有 Tailwind 类风格。Esc 关闭与现有 `Esc` 关闭搜索兼容(对话框打开时 Esc 优先关对话框)。

### 6.3 自测用例

- [ ] 原生菜单出现"帮助"子菜单,含"快捷键"和"关于 InkStone MD"两项。
- [ ] 点"快捷键" / 按 `F1` → 弹出快捷键对话框,内容完整、分组清晰。
- [ ] 点"关于" → 弹出关于对话框,版本号正确显示 `1.3.0`。
- [ ] Esc / 点遮罩 / 点关闭按钮 → 对话框关闭。
- [ ] 对话框打开时 Esc 优先关对话框,不触发其他 Esc 行为。
- [ ] 快捷键对话框内容与 README 快捷键表一致。

## 七、关键文件与改动落点

| 文件 | 改动概要 |
|---|---|
| `package.json` | version → 1.3.0(无新依赖,`@lucide/vue` 已有) |
| `src-tauri/Cargo.toml` | version → 1.3.0(无新 Rust 依赖) |
| `src-tauri/tauri.conf.json` | version → 1.3.0 |
| `src-tauri/src/lib.rs` | 视图菜单加"编辑模式"项;新增"帮助"子菜单(快捷键 + 关于);`on_menu_event` 透传新 id(已通用,无需改) |
| `src/App.vue` | 任务1:`viewMode` 枚举 + 工具栏编辑按钮 + 菜单 case + `Ctrl+\`;任务2:`scrollToCursor` 真实行高 + 触发时机;任务3:`toggleFocusMode` 开启即应用 + `updateCurrentLine` 真实行高 + 高亮强度;任务4:`showShortcutsModal`/`showAboutModal` + 两个 modal + `F1` + 菜单 case;`SHORTCUTS` 常量 |
| `vite.config.ts` | `define: { __APP_VERSION__ }` 注入版本号(供关于对话框用) |
| `README.md` / `README_EN.md` | 特性章节确认三模式;快捷键表加 `Ctrl+\` 和 `F1`;更正 `Ctrl+滚轮` 描述;版本记录加 1.3.0 条目 |

> **不**新增组件文件,继续单文件约定。本期 Rust 端仅菜单扩展(零新依赖),其余改动全部在前端。

## 八、开发顺序建议

建议按 1 → 2 → 3 → 4 顺序,每任务独立可验证:

1. **任务 1(纯编辑模式)**:先引入 `viewMode` 枚举 → 工具栏按钮 → 菜单项 → 快捷键。改完三模式可自由切换,后续任务都在编辑器可见态下验证,基础。
2. **任务 2(打字机)**:修 `scrollToCursor` 行高 → 补触发时机。肉眼验收:光标居中跟随。
3. **任务 3(专注)**:修 `updateCurrentLine` 行高 + 高亮强度 → `toggleFocusMode` 开启即应用。肉眼验收:当前行明显高亮。
4. **任务 4(菜单)**:Rust 加帮助菜单 → 前端两个 modal + `F1`。验收:菜单可点、对话框内容正确。

任务 2、3 都涉及"真实行高测算",可合并一个 `getEditorLineHeight(textarea)` 工具函数复用。

## 九、自测用例(汇总)

### 视图模式
- [ ] 编辑 / 分栏 / 预览三模式可经工具栏、菜单、`Ctrl+\` 切换,无非法态。
- [ ] 模式持久化,重启恢复。
- [ ] 滚动同步仅分栏生效;导出 PDF 仍正常。

### 打字机模式
- [ ] 开启即居中;打字 / 移动光标时光标行保持居中。
- [ ] 长行容错;预览模式不报错。

### 专注模式
- [ ] 开启即高亮当前行,浅/深主题都清晰。
- [ ] 光标移动高亮跟随;关闭后恢复正常。
- [ ] 与打字机模式可并存。

### 菜单栏
- [ ] "帮助"菜单含快捷键、关于两项。
- [ ] `F1` 弹快捷键对话框;关于对话框版本号正确。
- [ ] Esc / 遮罩 / 关闭按钮可关对话框。

## 十、质量门

- [ ] `npm run build`(vue-tsc + vite)零错误
- [ ] `cargo check`(在 `src-tauri/` 目录)零错误
- [ ] 真机打 NSIS 包并自测主要流程
- [ ] 关键流程录屏:切三模式 → 开打字机打字看居中 → 开专注看高亮 → 菜单看快捷键/关于
- [ ] README 同步更新(三模式、`Ctrl+\`、`F1`、版本记录 1.3.0)

## 十一、发布 Checklist

- [ ] 三处 version → 1.3.0(`package.json` / `Cargo.toml` / `tauri.conf.json`)
- [ ] `ROADMAP_V1.3.0.md` 自测项全部勾完
- [ ] `npm run tauri build` 在 Win 10 / Win 11 各跑一次
- [ ] 验证 .md 文件关联仍正常(不应被本期影响)
- [ ] 验证原生菜单在 Win/macOS(如有)都正确显示
- [ ] 打 tag:`git tag -a v1.3.0 -m "InkStone MD 1.3.0"` 并推 `origin`

## 十二、风险与回退

| 风险 | 缓解 |
|---|---|
| `viewMode` 枚举改造影响现有 `showSplit`/`showPreview` 引用(滚动同步、导出 PDF) | 用 `computed` 派生两个布尔值,保持下游 `showSplit.value` 读法不变,改动面最小 |
| 打字机 `scrollToCursor` 用字符比例估算在极端长文档偏差 | 兜底用真实 `lineHeight`;若验收不达标,升级为镜像 div 像素测量(已列备选) |
| 专注高亮内联 `background` 被主题背景盖住 | 高亮走 `background`、聚焦框走 `box-shadow`,且内联优先级高于类选择器;暗色主题用更高 rgba 透明度 |
| 原生菜单在 macOS 上"关于"与系统 About 重名冲突 | macOS 系统会自动加一个 About 菜单项;本期菜单项主要面向 Windows,macOS 若重复可条件编译跳过(本期不强求) |
| `__APP_VERSION__` 注入在 `vue-tsc` 类型报错 | 在 `vite-env.d.ts` 声明 `declare const __APP_VERSION__: string;` |
| `App.vue` 继续涨行 | 接受。两个 modal + 状态约增 150 行,记入 V1.4 候选拆分 |

## 十三、不在本期范围(留 V1.4+ 候选)

- 设置面板(统一管理所有偏好:字体/字号/行宽/行号开关等)
- 专注模式遮罩级段落淡化(方案 B)
- 打字机模式镜像 div 像素级居中
- DOCX / EPUB 导出
- 拼写检查
- 拆分 `App.vue` 组件化
- macOS 原生菜单适配(关于 / 偏好项归位)
