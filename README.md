# InkStone MD

[English](./README_EN.md) | 中文

一个轻量、优雅的桌面 Markdown 编辑器，基于 Tauri 2 + Vue 3 构建，支持实时预览、所见即所得、代码高亮、数学公式、Mermaid 图表、多套主题、文件关联等开箱即用的能力。

![preview](docs/preview.png)

## 特性

**内容创作**

- 多模式实时预览：分栏 / 纯编辑 / 纯预览，输入即渲染
- 丰富语法：代码高亮（行号 + 复制）、KaTeX 公式、Mermaid 图表、任务列表、脚注
- GitHub 提示块 `[!NOTE]` 等五种语义、`==高亮==`、`^上标^`、`~下标~`
- Front-matter 元信息卡、音视频嵌入（`![](demo.mp4)` → 原生播放器）
- `[[toc]]` 目录、标题 hover 锚点复制、图注（`title` 属性）
- 搜索替换（`Ctrl+F`）、自动配对括号、剪贴板图片自动落盘
- 图片交互：悬浮工具栏缩放/对齐，点击打开灯箱（滚轮缩放）
- 表格可视化编辑：编辑、± 行列、保存到源、复制为 Markdown

**视图与导航**

- 大纲 / TOC 侧边栏，点击双向跳转，当前标题高亮跟随滚动
- 分栏双向滚动同步（`F7` 开关）、预览顶部阅读进度条
- 双区文件树：应用内「我的库」+ 外部文件夹，完整 CRUD / 拖拽移动 / 库迁移
- 资源面板：扫描文档引用的图片，支持定位、重命名、移动、压缩、复制引用
- 最近文件自动记录

**文件与协作**

- Windows 文件关联：双击 `.md` / `.markdown` / `.txt` 直接打开；单实例、命令行与拖拽打开
- 30 秒自动保存
- 导出 HTML：单文件全内联（样式 + 主题 + 图片 base64 + Mermaid/KaTeX），离线可用
- 导出 PDF：隐藏 iframe 打印，文字可选可搜索，样式与预览一致

**主题与个性化**

- 4 套内置主题：InkStone / GitHub / One Dark / Typora，深浅色双模式
- 阅读偏好（`Ctrl+,`）：字体、字号、行宽、代码高亮主题，即换即生效，导出同步

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+N` / `Ctrl+O` | 新建 / 打开文件 |
| `Ctrl+S` / `Ctrl+Shift+S` | 保存 / 另存为 |
| `Ctrl+B` | 切换侧边栏 |
| `Ctrl+F` | 搜索替换 |
| `Ctrl+\` | 循环切换 编辑 / 分栏 / 预览 |
| `Ctrl+,` | 阅读偏好设置 |
| `F7` | 切换滚动同步 |
| `F1` | 快捷键说明 |
| `Esc` | 关闭搜索面板 / 对话框 |

## 安装

### 从源码构建

```bash
npm install          # 安装依赖
npm run dev          # 仅前端（Vite 热重载）
npm run tauri dev    # 完整开发模式（前端 + Rust）
npm run build        # vue-tsc 类型检查 + Vite 打包
npm run tauri build  # NSIS 安装包（Windows 需管理员）
```

### 安装包

`npm run tauri build` 完成后，安装包位于 `src-tauri/target/release/bundle/nsis/InkStone MD_1.6.0_x64-setup.exe`。双击安装即自动注册 `.md` / `.markdown` / `.txt` 文件关联；通过"控制面板 → 添加或删除程序"卸载，不留关联残留。

## 技术栈

- **前端**：Vue 3 + TypeScript + Vite + TailwindCSS，图标 `@lucide/vue`
- **后端**：Tauri 2.x（Rust），图片压缩走 `image` crate
- **Markdown**：markdown-it + task-lists / footnote / github-alerts / mark / sub / sup
- **其他**：highlight.js（lib/common 按需）、KaTeX、mermaid

## 项目结构

```
inkstone-md/
├── src/                       # Vue 前端源码
│   ├── App.vue                # 主组件（tab/快捷键/事件编排 + 预览交互绑定）
│   ├── assets/                # 预览内容样式（markdown-body.css 单一真源）
│   ├── components/            # SFC 组件（工具栏/Tab/编辑器/文件树/设置面板/灯箱…）
│   ├── composables/           # useWorkspace（双区文件树）/ useExport（导出打印）
│   ├── constants/             # 主题与高亮选项 / 欢迎文档 / 导出 CSS
│   ├── types/                 # TypeScript 类型声明
│   ├── utils/                 # utils.ts 工具函数 / markdown.ts 渲染管线
│   ├── style.css              # 应用外壳样式
│   └── main.ts                # Vue 入口
├── src-tauri/                 # Tauri 后端（lib.rs 命令与单实例，详见 AGENTS.md）
├── docs/
│   ├── preview.png            # 预览图
│   └── roadmaps/              # 各版本发布规划与验收清单（V1.0.0 → V1.6.0）
├── CHANGELOG.md               # 版本更新日志
└── AGENTS.md                  # 开发指南（架构 / 关键链路 / 发布流程）
```

## 文档

| 文档 | 内容 |
|------|------|
| [CHANGELOG.md](./CHANGELOG.md) | 版本更新日志 |
| [docs/roadmaps/](./docs/roadmaps/) | 各版本发布规划、决策记录与验收清单 |
| [AGENTS.md](./AGENTS.md) | 开发指南：架构、关键链路、Rust 命令、发布流程 |
| [README_EN.md](./README_EN.md) | 英文说明（更新滞后于中文版） |

## 贡献

欢迎提交 Issue 与 Pull Request。开发前请先 `npm install` 并确保 `npm run build` 与 `cargo check` 均无错误，开发约定见 [AGENTS.md](./AGENTS.md)。

## 许可证

GPL-3.0 License
