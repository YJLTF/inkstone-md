/** 新建标签页时的欢迎文档(覆盖主要语法特性) */
export const defaultContent = `# 欢迎使用 InkStone MD

> 简洁、高效的 Markdown 编辑器

## 所见即所得

- **实时预览** - 输入即渲染
- **轻量级** - Tauri + Vue 构建
- 快捷键按 <kbd>Ctrl</kbd> + <kbd>F</kbd> 搜索？试试 ==高亮标记==、^上标^、~下标~ 与 ~~删除线~~

## 提示块

> [!NOTE]
> GitHub 风格提示块,支持 NOTE / TIP / IMPORTANT / WARNING / CAUTION 五种语义。

> [!TIP]
> 写文档时把注意事项放进提示块,阅读体验更好。

## 代码示例

\`\`\`javascript
function hello() {
  console.log("Hello, InkStone!");
}
\`\`\`

## 数学公式

行内公式: $E = mc^2$

块级公式:
$$
\\sum_{i=1}^n i = \\frac{n(n+1)}{2}
$$

## 任务列表

- [x] 安装 InkStone MD
- [ ] 写一篇文档
- [ ] 享受写作

## 表格

| 快捷键 | 作用 |
| --- | --- |
| \`Ctrl+\\\` | 切换编辑/分栏/预览 |
| \`Ctrl+S\` | 保存 |

---

**开始编辑吧!**
`;
