# InkStone MD

[English](./README_EN.md) | 中文

一个轻量、优雅的桌面 Markdown 编辑器，基于 Tauri + Vue 3 构建。

## 特性

### 编辑功能
- 多标签页编辑
- 实时预览（分栏 / 纯编辑 / 纯预览三种模式）
- 搜索替换 (Ctrl+F)
- 自动配对（括号、引号等）
- 脚注支持
- 图片拖拽插入
- Mermaid 图表支持
- 数学公式支持 (KaTeX)
- 任务列表支持

### 视图功能
- 大纲视图 / TOC
- 文件树侧边栏（支持打开文件夹、右键新建/重命名/删除）
- 专注模式 (F8) - 隐藏侧边栏和工具栏，专注写作
- 打字机模式 (F9) - 保持光标居中

### 界面主题
- 深色 / 浅色模式
- 主题持久化

### 实用功能
- 30秒自动保存
- 最近文件
- 字数统计详情
- 拖拽打开文件
- 导出 HTML
- 快捷键 (Ctrl+N/O/S/B)

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| Ctrl+N | 新建文件 |
| Ctrl+O | 打开文件 |
| Ctrl+S | 保存文件 |
| Ctrl+B | 加粗 |
| Ctrl+F | 搜索替换 |
| F8 | 专注模式 |
| F9 | 打字机模式 |

## 安装

### 从源码构建

```bash
# 安装依赖
npm install

# 开发模式
npm run dev

# Tauri 开发模式
npm run tauri dev

# 构建
npm run build
npm run tauri build
```

### 预览

```bash
npm run preview
```

## 技术栈

- **前端**: Vue 3 + TypeScript + Vite + TailwindCSS
- **后端**: Tauri 2.x (Rust)
- **Markdown 解析**: markdown-it + markdown-it-task-lists + highlight.js + KaTeX + mermaid

## 项目结构

```
inkstone-md/
├── src/                    # Vue 前端源码
│   ├── App.vue            # 主组件
│   └── main.ts            # 入口文件
├── src-tauri/             # Tauri 后端源码
│   ├── src/
│   │   ├── lib.rs         # 库入口
│   │   └── main.rs        # Rust 入口
│   ├── Cargo.toml         # Rust 依赖
│   └── tauri.conf.json    # Tauri 配置
├── package.json           # Node 依赖
└── vite.config.ts         # Vite 配置
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！