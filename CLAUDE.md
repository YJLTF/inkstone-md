# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

InkStone MD 是一个基于 Tauri + Vue 3 的桌面 Markdown 编辑器，支持实时预览、代码高亮、数学公式（KaTeX）、任务列表等功能。

## Commands

```bash
# 开发
npm run dev              # 启动 Vite 开发服务器
npm run tauri dev        # 启动 Tauri 开发模式（包含前端 + 后端）

# 构建
npm run build            # TypeScript 类型检查 + Vite 构建
npm run tauri build      # 构建 Tauri 应用（生成 .exe）

# 预览
npm run preview          # 预览构建后的前端
```

## Architecture

### 技术栈
- **前端**: Vue 3 + TypeScript + Vite + TailwindCSS
- **后端**: Tauri 2.x (Rust)
- **Markdown 解析**: markdown-it + markdown-it-task-lists + highlight.js + KaTeX

### 核心模块
- `src/App.vue`: 主组件，包含编辑器核心逻辑（标签页、文件树、渲染、工具栏）
- `src/main.ts`: Vue 应用入口
- `src-tauri/src/main.rs`: Rust 入口，调用 `inkstone_md_lib::run()`
- `src-tauri/tauri.conf.json`: Tauri 应用配置（窗口、构建目标）

### Tauri 能力
- `@tauri-apps/plugin-dialog`: 文件/文件夹选择对话框
- `@tauri-apps/plugin-fs`: 文件系统读写
- `@tauri-apps/api/core`: Rust 命令调用 (read_file, write_file, read_directory)
- `@tauri-apps/api/window`: 窗口标题管理
- `@tauri-apps/api/event`: 监听菜单事件

### 编辑器特性
- 多标签页编辑
- 文件树侧边栏（支持右键新建文件/文件夹、重命名、删除）
- 实时渲染（分栏/纯编辑/纯预览三种模式）
- 大纲视图 / TOC
- 搜索替换 (Ctrl+F)
- 自动配对（括号、引号等）
- 脚注支持
- 图片拖拽插入
- Mermaid 图表支持
- 专注模式 (F8)
- 打字机模式 (F9)
- 深色/浅色模式
- 主题持久化
- 30秒自动保存
- 最近文件
- 字数统计详情
- 拖拽打开文件
- 快捷键 (Ctrl+N/O/S/B)
- 导出 HTML

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

## Windows 注意事项

- Windows 路径使用反斜杠 `\` 但 Tauri 内部需转换为正斜杠 `/`
- 路径处理使用 `.replace(/\\/g, '/')` 确保跨平台兼容