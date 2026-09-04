import MarkdownIt from "markdown-it";
import mk from "markdown-it-task-lists";
import footnote from "markdown-it-footnote";
import alerts from "markdown-it-github-alerts";
import mark from "markdown-it-mark";
import mdSub from "markdown-it-sub";
import mdSup from "markdown-it-sup";
import hljs from "highlight.js/lib/common";
import katex from "katex";
import "katex/dist/katex.min.css";
import { convertFileSrc } from "@tauri-apps/api/core";
import { isAbsolutePath, posixNormalize, slugify, escapeHtml } from '../utils';
import type { Heading } from '../types';

// GitHub 提示块的 lucide 风格图标(stroke 风格,currentColor 跟随文字色)
const INK_ALERT_ICONS: Record<string, string> = {
  note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
  tip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/></svg>',
  important: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><path d="M12 7v4"/><path d="M12 15h.01"/></svg>',
  warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  caution: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2h4l6 6v8l-6 6h-4l-6-6V8z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>',
};

export const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
  highlight: (str, lang) => {
    // 用 <div class="line"> 把每行包起来,这样 CSS 能让行号与代码行一一对齐。
    const wrap = (s: string) =>
      s
        .split("\n")
        .map((line) => `<div class="line">${line || " "}</div>`)
        .join("");
    if (lang && hljs.getLanguage(lang)) {
      try {
        return wrap(hljs.highlight(str, { language: lang }).value);
      } catch {}
    }
    return wrap(escapeHtml(str));
  },
});
md.use(mk, { enabled: true, label: true });
md.use(footnote);
md.use(mark);
md.use(mdSub);
md.use(mdSup);
md.use(alerts, {
  classPrefix: "ink-alert",
  titles: { note: "注意", tip: "提示", important: "重要", warning: "警告", caution: "当心" },
  icons: INK_ALERT_ICONS,
});

// 图片带 title 时渲染为图注结构(span 保证在 <p> 内合法)
const defaultImageRenderer = md.renderer.rules.image!;
md.renderer.rules.image = (tokens, idx, options, env, self) => {
  const inner = defaultImageRenderer(tokens, idx, options, env, self);
  const title = tokens[idx].attrGet("title");
  if (!title) return inner;
  return `<span class="ink-figure">${inner}<span class="ink-figure-caption">${escapeHtml(title)}</span></span>`;
};

function toTauriAssetUrl(src: string, currentFilePath: string | null): string {
  if (/^(https?:|data:|blob:|tauri:|asset:)/i.test(src)) return src;
  let abs: string;
  if (isAbsolutePath(src)) {
    abs = posixNormalize(src.replace(/\\/g, "/"));
  } else {
    if (!currentFilePath) return src;
    const dir = currentFilePath.replace(/\\/g, "/").split("/").slice(0, -1).join("/");
    abs = posixNormalize(dir + "/" + src);
  }
  try {
    return convertFileSrc(abs);
  } catch {
    return src;
  }
}

/**
 * 对 markdown 源串中"代码块之外"的部分应用 fn,跳过 fenced(```/~~~)与行内(`)代码,
 * 避免 toc/图片等预处理改写到代码块内部。代码块原样保留。
 */
function mapOutsideCode(content: string, fn: (s: string) => string): string {
  const store: string[] = [];
  const stash = (m: string) => {
    const i = store.length;
    store.push(m);
    return `\u0000K${i}\u0000`;
  };
  let s = content.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, stash);
  s = s.replace(/`[^`\n]*`/g, stash);
  s = fn(s);
  return s.replace(/\u0000K(\d+)\u0000/g, (_, i) => store[+i]);
}

/**
 * 在 markdown-it 渲染前,把图片语法里的本地 src 改写为 tauri 资源 URL,
 * 让 webview 通过 assetProtocol 正确加载本地图片。
 * 规则:
 *   - http(s)/data/blob/tauri/asset: 原样保留
 *   - Windows 绝对路径 (C:\...) / UNC / 类 Unix 绝对路径: 规范化后 convertFileSrc
 *   - 相对路径: 相对当前 tab 文件所在目录,convertFileSrc
 *   - 文件未保存: 保留原 src(后续保存后再打开会失效,但不破坏编辑)
 */
export function preprocessImageSrcs(content: string, currentFilePath: string | null): string {
  return mapOutsideCode(content, (s) =>
    s.replace(
      /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g,
      (m, alt: string, src: string, _title?: string) => {
        const newSrc = toTauriAssetUrl(src, currentFilePath);
        if (newSrc === src) return m;
        return `![${alt}](${newSrc})`;
      },
    ),
  );
}

/**
 * 将文本中出现的 `[[toc]]` 标记替换为基于 `headings` 渲染出的目录 HTML。
 * `markdown-it` 配 `html: true` 会把 inline HTML 原样保留,所以我们直接在源字符串
 * 上做替换,然后交给 markdown-it 渲染,这样目录内含的 <ul> 不会被解析成 markdown。
 */
export function preprocessToc(content: string, heads: Heading[]): string {
  if (!content.includes('[[toc]]')) return content;
  let repl: string;
  if (heads.length === 0) {
    repl = '<p class="ink-toc-empty">暂无标题</p>';
  } else {
    const buildList = (idx: number, minLevel: number): { html: string; next: number } => {
      let out = '<ul>';
      while (idx < heads.length) {
        const h = heads[idx];
        if (h.level < minLevel) break;
        if (h.level > minLevel) {
          const sub = buildList(idx, h.level);
          out += `<li>${sub.html}`;
          idx = sub.next;
          out += '</li>';
          continue;
        }
        const anchor = slugify(h.text);
        out += `<li><a href="#${anchor}">${escapeHtml(h.text)}</a></li>`;
        idx++;
      }
      out += '</ul>';
      return { html: out, next: idx };
    };
    const { html } = buildList(0, heads[0].level);
    repl = `<nav class="ink-toc"><div class="ink-toc-title">目录</div>${html}</nav>`;
  }
  // 仅替换代码块之外的 [[toc]],代码块内的原样保留
  return mapOutsideCode(content, (s) => s.replace(/\[\[toc\]\]/g, repl));
}

// ---- Front-matter 元信息卡 ----

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/;
// 标签类键渲染为 chips,日期类键为普通行,其余键为普通行
const FM_TAG_KEYS = /^(tags?|keywords|标签|关键词)$/i;

export interface InkFrontMatter {
  title: string | null;
  entries: { key: string; values: string[] }[];
}

function stripQuotes(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

/** 极简 YAML 子集解析:key: value / key: 换行后 - 列表 / 内联 [a, b]。不追求完整 YAML。 */
function parseFrontMatter(raw: string): InkFrontMatter | null {
  const entries: { key: string; values: string[] }[] = [];
  let current: { key: string; values: string[] } | null = null;
  for (const line of raw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const listItem = line.match(/^\s+-\s+(.+)$/);
    if (listItem && current) {
      current.values.push(stripQuotes(listItem[1]));
      continue;
    }
    const kv = line.match(/^([A-Za-z_\u4e00-\u9fa5][\w\-\s\u4e00-\u9fa5/]*?)\s*:\s*(.*)$/);
    if (!kv) continue;
    current = { key: kv[1].trim(), values: [] };
    const rest = kv[2].trim();
    if (rest) {
      if (/^\[.*\]$/.test(rest)) {
        current.values = rest.slice(1, -1).split(",").map(stripQuotes).filter(Boolean);
      } else {
        current.values = [stripQuotes(rest)];
      }
    }
    entries.push(current);
  }
  if (entries.length === 0) return null;
  const titleEntry = entries.find((e) => /^title$/i.test(e.key) || e.key === "标题");
  return { title: titleEntry?.values[0] ?? null, entries };
}

/**
 * 提取文件头的 front-matter;若开头 --- 块解析不出有效键值对
 * (比如文章本身以水平线开头),按无 front-matter 处理,原文返回。
 */
export function extractFrontMatter(content: string): { fm: InkFrontMatter | null; body: string } {
  const m = content.match(FRONTMATTER_RE);
  if (m) {
    const fm = parseFrontMatter(m[1]);
    if (fm) return { fm, body: content.slice(m[0].length) };
  }
  return { fm: null, body: content };
}

/** front-matter 渲染为文档顶部元信息卡;注意内部不得使用 h1-h6(会干扰 addHeadingIds 对齐) */
export function renderFrontMatterCard(fm: InkFrontMatter | null): string {
  if (!fm) return "";
  const rows: string[] = [];
  for (const e of fm.entries) {
    if (/^title$/i.test(e.key) || e.key === "标题") continue;
    const label = escapeHtml(e.key);
    if (FM_TAG_KEYS.test(e.key) && e.values.length > 0) {
      const chips = e.values
        .map((v) => `<span class="ink-frontmatter-chip">${escapeHtml(v)}</span>`)
        .join("");
      rows.push(`<div class="ink-frontmatter-row"><span class="ink-frontmatter-key">${label}</span><span class="ink-frontmatter-chips">${chips}</span></div>`);
    } else {
      rows.push(`<div class="ink-frontmatter-row"><span class="ink-frontmatter-key">${label}</span><span class="ink-frontmatter-value">${escapeHtml(e.values.join(", "))}</span></div>`);
    }
  }
  if (rows.length === 0 && !fm.title) return "";
  const title = fm.title ? `<div class="ink-frontmatter-title">${escapeHtml(fm.title)}</div>` : "";
  return `<div class="ink-frontmatter">${title}<div class="ink-frontmatter-rows">${rows.join("")}</div></div>`;
}

// ---- 音视频嵌入:图片语法指向媒体文件时渲染为原生播放器 ----

const VIDEO_EXTS = ["mp4", "webm", "mov", "m4v"];
const AUDIO_EXTS = ["mp3", "wav", "ogg", "m4a", "flac", "aac"];

export function embedMediaTags(html: string): string {
  return html.replace(/<img\s+([^>]*?)\/?>/g, (m, attrs: string) => {
    const srcMatch = attrs.match(/\bsrc=["']([^"']+)["']/i);
    if (!srcMatch) return m;
    const ext = (srcMatch[1].split(/[?#]/)[0].split(".").pop() || "").toLowerCase();
    if (VIDEO_EXTS.includes(ext)) {
      return `<video class="ink-media" controls preload="metadata" src="${srcMatch[1]}"></video>`;
    }
    if (AUDIO_EXTS.includes(ext)) {
      return `<audio class="ink-media" controls preload="metadata" src="${srcMatch[1]}"></audio>`;
    }
    return m;
  });
}

export function addHeadingIds(html: string, heads: Heading[]): string {
  const used = new Map<string, number>();
  const slugList = heads.map((h) => {
    const base = slugify(h.text);
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    return count === 0 ? base : `${base}-${count + 1}`;
  });
  let idx = 0;
  return html.replace(/<h([1-6])>/g, (_m, level) => {
    if (idx >= slugList.length) return `<h${level}>`;
    const id = slugList[idx++];
    // hover 时浮现的 # 锚点:预览中点击复制锚点;导出物中作为普通锚点链接可跳转
    return `<h${level} id="${id}" class="ink-heading"><a class="ink-heading-anchor" data-anchor="${id}" href="#${id}" title="复制锚点链接">#</a>`;
  });
}

/**
 * 用 markdown-it 解析 content,提取每个表格在源 markdown 中的字符 offset 区间,
 * 用于表格编辑"保存到源"功能定位原段。
 * `token.map = [startLine, endLine]` 0-indexed 半开区间,lineToOffset 把行号转为字符 offset。
 */
export function findTableRanges(content: string): { start: number; end: number; md: string }[] {
  let tokens: any[] = [];
  try {
    tokens = md.parse(content, {});
  } catch {
    return [];
  }
  const lines = content.split("\n");
  const lineToOffset = (line0: number) => {
    let off = 0;
    for (let l = 0; l < line0 && l < lines.length; l++) off += lines[l].length + 1;
    return off;
  };
  const ranges: { start: number; end: number; md: string }[] = [];
  for (const t of tokens) {
    if (t.type === "table_open" && t.map) {
      const [sLine, eLine] = t.map as [number, number];
      const start = lineToOffset(sLine);
      const end = lineToOffset(eLine);
      ranges.push({ start, end, md: content.slice(start, end) });
    }
  }
  return ranges;
}

/** 把渲染出的 <img> 包成可交互结构(悬浮缩放/对齐工具栏),不写回 markdown,仅控制显示。 */
function wrapImagesForInteraction(html: string): string {
  return html.replace(/<img\s+([^>]*?)\/?>/g, (m, attrs: string) => {
    const srcMatch = attrs.match(/\bsrc=["']([^"']+)["']/i);
    if (!srcMatch) return m;
    const src = srcMatch[1];
    return (
      `<span class="ink-image-wrap" data-scale="100" data-align="center">` +
        `<img ${attrs} data-original="${src.replace(/"/g, "&quot;")}" />` +
        `<span class="ink-image-toolbar" contenteditable="false">` +
          `<button type="button" data-act="zoom-out" title="缩小">−</button>` +
          `<span class="ink-image-scale">100%</span>` +
          `<button type="button" data-act="zoom-in" title="放大">+</button>` +
          `<span class="ink-image-sep"></span>` +
          `<button type="button" data-act="align-left" title="左对齐">⫷</button>` +
          `<button type="button" data-act="align-center" title="居中">≡</button>` +
          `<button type="button" data-act="align-right" title="右对齐">⫸</button>` +
        `</span>` +
      `</span>`
    );
  });
}

/**
 * 把 markdown-it 渲染出的 `<pre><code class="language-xxx">…</code></pre>`
 * 包成 `<div class="ink-codeblock">` 并附加语言标签 + 复制按钮。
 */
function wrapCodeBlocks(html: string): string {
  return html.replace(
    /<pre>\s*<code(?:\s+class="([^"]*)")?\s*>([\s\S]*?)<\/code>\s*<\/pre>/g,
    (_m, cls: string | undefined, inner: string) => {
      const langMatch = (cls || "").match(/language-([^\s"]+)/);
      const lang = langMatch ? langMatch[1] : "";
      const lineMatches = inner.match(/<div class="line">/g) || [];
      const lineCount = Math.max(lineMatches.length, 1);
      const nums = Array.from({ length: lineCount }, (_, i) => `<li>${i + 1}</li>`).join("");
      return (
        `<div class="ink-codeblock" data-lang="${lang}">` +
          `<div class="ink-codeblock-toolbar">` +
            `<span class="ink-codeblock-lang">${lang || "text"}</span>` +
            `<button type="button" class="ink-codeblock-copy" data-act="copy-code">复制</button>` +
          `</div>` +
          `<div class="ink-codeblock-body">` +
            `<pre class="${cls ? (cls.includes("hljs") ? "hljs" : "") : ""}">` +
              `<ol class="ink-line-nums">${nums}</ol>` +
              `<code${cls ? ` class="${cls}"` : ""}>${inner}</code>` +
            `</pre>` +
          `</div>` +
        `</div>`
      );
    },
  );
}

/** 把渲染出的 `<table>` 包成 `<div class="ink-table">` 并附加编辑工具栏。
 * `tableRanges` 由 `findTableRanges(content)` 提供,顺序与渲染出的 <table> 一一对应。 */
function wrapTablesForEdit(
  html: string,
  tableRanges: { start: number; end: number; md: string }[],
): string {
  let idx = 0;
  return html.replace(/<table>([\s\S]*?)<\/table>/g, (_m, inner: string) => {
    const r = tableRanges[idx++];
    const dataMd = r ? ` data-source-md="${encodeURIComponent(r.md)}"` : "";
    return (
      `<div class="ink-table" data-edit="false"${dataMd}>` +
        `<div class="ink-table-toolbar">` +
          `<button type="button" data-act="t-edit">✏️ 编辑</button>` +
          `<button type="button" data-act="t-add-row">+ 行</button>` +
          `<button type="button" data-act="t-del-row">- 行</button>` +
          `<button type="button" data-act="t-add-col">+ 列</button>` +
          `<button type="button" data-act="t-del-col">- 列</button>` +
          `<button type="button" data-act="t-save">💾 保存到源</button>` +
        `</div>` +
        `<table>${inner}</table>` +
      `</div>`
    );
  });
}

// ---- 公共渲染管线 ----

/** mermaid 代码块 → 占位 div,由运行期 renderMermaidDiagrams / 导出物内联脚本接管 */
function replaceMermaidBlocks(html: string, includeFallbackText: boolean): string {
  return html.replace(/<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g, (_, code) => {
    const id = "mermaid-" + Math.random().toString(36).slice(2, 11);
    const decoded = code.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").trim();
    const fallback = includeFallbackText ? escapeHtml(decoded) : "";
    return `<div class="mermaid-diagram" data-id="${id}" data-code="${encodeURIComponent(decoded)}">${fallback}</div>`;
  });
}

/** 暂存 <pre>/<code> 后渲染 KaTeX 公式($$...$$ 与 $...$),避免公式正则穿透代码,再还原 */
function renderKatexOutsideCode(html: string): string {
  const codeStore: string[] = [];
  const stash = (m: string) => {
    const i = codeStore.length;
    codeStore.push(m);
    return `\u0000C${i}\u0000`;
  };
  html = html.replace(/<pre\b[^>]*>[\s\S]*?<\/pre>/g, stash);
  html = html.replace(/<code\b[^>]*>[\s\S]*?<\/code>/g, stash);
  // 先处理块级公式（多行 $$...$$）
  html = html.replace(/\$\$([\s\S]+?)\$\$/g, (_, tex) => {
    try {
      const cleanTex = tex.trim();
      return `<div class="katex-display">${katex.renderToString(cleanTex, { throwOnError: false, displayMode: true })}</div>`;
    } catch {
      return `<div class="katex-error">${tex}</div>`;
    }
  });
  // 再处理行内公式（单行 $...$）
  html = html.replace(/\$([^$\n]+)\$/g, (_, tex) => {
    try {
      return katex.renderToString(tex, { throwOnError: false });
    } catch {
      return tex;
    }
  });
  return html.replace(/\u0000C(\d+)\u0000/g, (_, i) => codeStore[+i]);
}

/**
 * 统一的 markdown → HTML 渲染管线(预览与导出共用,消灭两份漂移副本)。
 * 入参 source 应已完成 front-matter 剥离 / 图片 src 预处理 / [[toc]] 替换。
 * - interactive: 附加预览专用的交互包装(图片/代码块/表格工具栏);导出物跳过
 * - mermaidFallback: 占位 div 内预置转义后的源码,供无 JS 环境回退显示(导出 HTML 用)
 */
export function renderMarkdownHTML(
  source: string,
  heads: Heading[],
  opts: { interactive?: boolean; mermaidFallback?: boolean } = {},
): string {
  let html = md.render(source);
  html = replaceMermaidBlocks(html, opts.mermaidFallback ?? false);
  html = renderKatexOutsideCode(html);
  html = addHeadingIds(html, heads);
  // 媒体文件渲染为播放器(需在图片包装之前,避免 video/audio 被当作图片包工具栏)
  html = embedMediaTags(html);
  if (opts.interactive) {
    html = wrapImagesForInteraction(html);
    html = wrapCodeBlocks(html);
    html = wrapTablesForEdit(html, findTableRanges(source));
  }
  return html;
}
