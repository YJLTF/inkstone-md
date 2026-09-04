import { ref } from "vue";
import type { ComputedRef, Ref } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import katexCss from "katex/dist/katex.min.css?raw";
import mermaidJs from "mermaid/dist/mermaid.min.js?raw";
import mdBodyCss from "../assets/markdown-body.css?raw";
import { EXPORT_SHELL_CSS, PRINT_CSS } from '../constants/exportCss';
import { FONT_STACKS, getHljsThemeCss } from '../constants/options';
import { isAbsolutePath, escapeHtml, getMimeFromExt, bytesToBase64, fetchAsDataUri } from '../utils';
import {
  extractFrontMatter,
  preprocessToc,
  renderFrontMatterCard,
  renderMarkdownHTML,
} from '../utils/markdown';
import type { Tab, Heading, ThemeName } from '../types';

/** 导出/打印所需的响应式依赖,由 App.vue 注入 */
export interface ExportDeps {
  activeTab: ComputedRef<Tab | undefined>;
  headings: ComputedRef<Heading[]>;
  themeName: Ref<ThemeName>;
  isDark: Ref<boolean>;
  hljsTheme: Ref<string>;
  readerFont: Ref<string>;
  readerFontSize: Ref<string>;
  readerWidth: Ref<string>;
}

interface CapturedTheme {
  dataTheme: string;
  isDark: boolean;
  fontFamily: string;
  bodyBg: string;
  bodyColor: string;
  highlightCss: string;
  readerCss: string;
}

export function useExport(deps: ExportDeps) {
  const { activeTab, headings, themeName, isDark, hljsTheme, readerFont, readerFontSize, readerWidth } = deps;

  /** 读取当前主题/阅读偏好的实时生效值(getComputedStyle 直接取 <html> 上的最终值,与样式表天然同步) */
  function captureCurrentTheme(): CapturedTheme {
    const cs = getComputedStyle(document.documentElement);
    const dark = isDark.value;
    // 代码高亮:跟随阅读偏好;auto 时按亮暗选 github 系
    const highlightCss = getHljsThemeCss(hljsTheme.value, dark);
    // 阅读偏好覆盖(仅收集用户显式选择的项;auto 交给主题变量)
    const fontStack = readerFont.value === "auto" ? null : (FONT_STACKS[readerFont.value] ?? null);
    let readerCss = "";
    if (fontStack) readerCss += `  --ink-md-font-family: ${fontStack};\n`;
    if (readerFontSize.value !== "auto") readerCss += `  --ink-md-font-size: ${readerFontSize.value}px;\n`;
    if (readerWidth.value !== "auto") readerCss += `  --ink-md-max-width: ${readerWidth.value}px;\n`;
    return {
      dataTheme: themeName.value,
      isDark: dark,
      fontFamily: fontStack || cs.fontFamily,
      bodyBg: cs.backgroundColor,
      bodyColor: cs.color,
      highlightCss,
      readerCss,
    };
  }

  /**
   * 把 markdown 中的本地图片内联为 data URI(base64),网络图片尝试 fetch 内联。
   * 不可用的图片保持原样。
   */
  async function inlineImagesInMarkdown(
    markdown: string,
    currentFilePath: string | null,
  ): Promise<string> {
    const re = /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g;
    type Hit = { start: number; end: number; alt: string; src: string };
    const hits: Hit[] = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(markdown)) !== null) {
      hits.push({ start: m.index, end: m.index + m[0].length, alt: m[1], src: m[2] });
    }
    if (hits.length === 0) return markdown;

    let out = markdown;
    for (let i = hits.length - 1; i >= 0; i--) {
      const h = hits[i];
      let newSrc = h.src;

      if (/^(data:|blob:)/i.test(h.src)) {
        continue;
      } else if (/^https?:/i.test(h.src)) {
        const inlined = await fetchAsDataUri(h.src);
        if (inlined) newSrc = inlined;
      } else {
        // 本地路径
        let absPath: string;
        if (isAbsolutePath(h.src)) {
          absPath = h.src.replace(/\\/g, "/");
        } else if (currentFilePath) {
          const dir = currentFilePath
            .replace(/\\/g, "/")
            .split("/")
            .slice(0, -1)
            .join("/");
          absPath = dir + "/" + h.src;
        } else {
          continue;
        }
        try {
          const bytes = (await invoke<number[]>("read_file_bytes", { path: absPath })) as number[];
          const ext = absPath.split(".").pop() || "";
          newSrc = `data:${getMimeFromExt(ext)};base64,${bytesToBase64(bytes)}`;
        } catch (e) {
          console.warn("导出图片内联失败:", absPath, e);
          continue;
        }
      }

      out = out.slice(0, h.start) + `![${h.alt}](${newSrc})` + out.slice(h.end);
    }
    return out;
  }

  /** 渲染 markdown 到"可导出" HTML(不带交互包装,管线与预览同源) */
  function renderHTMLForExport(source: string): string {
    return renderMarkdownHTML(source, headings.value, { mermaidFallback: true });
  }

  /** 导出物内嵌的 mermaid 初始化脚本:渲染所有占位图,完成后派发 mermaid-ready(打印等待用) */
  function mermaidInitScript(dark: boolean): string {
    return `
(function() {
  if (typeof mermaid === 'undefined') return;
  try {
    mermaid.initialize({
      startOnLoad: false,
      theme: ${dark ? "'dark'" : "'default'"},
      securityLevel: 'loose',
      fontFamily: 'inherit'
    });
    var diagrams = document.querySelectorAll('.mermaid-diagram[data-code]');
    var pending = diagrams.length;
    if (pending === 0) { window.dispatchEvent(new Event('mermaid-ready')); return; }
    diagrams.forEach(function(el, i) {
      var code = decodeURIComponent(el.getAttribute('data-code') || '');
      if (!code) { if (--pending === 0) window.dispatchEvent(new Event('mermaid-ready')); return; }
      var id = 'm-' + Date.now() + '-' + i;
      mermaid.render(id, code).then(function(r) {
        el.innerHTML = r.svg;
        if (--pending === 0) window.dispatchEvent(new Event('mermaid-ready'));
      }).catch(function(e) {
        el.innerHTML = '<pre class="mermaid-error">Mermaid 渲染失败: ' + (e.message || e) + '</pre>';
        if (--pending === 0) window.dispatchEvent(new Event('mermaid-ready'));
      });
    });
  } catch (e) {
    console.error('Mermaid init failed:', e);
    window.dispatchEvent(new Event('mermaid-ready'));
  }
})();`;
  }

  /** 组装可独立打开/打印的单文件 HTML(lightColors=true 时强制黑字白底,用于打印) */
  function buildStandaloneHtml(opts: {
    theme: CapturedTheme;
    title: string;
    bodyHtml: string;
    lightColors?: boolean;
    withViewport?: boolean;
  }): string {
    const { theme, title, bodyHtml, lightColors, withViewport } = opts;
    return `<!DOCTYPE html>
<html lang="zh-CN" data-theme="${theme.dataTheme}"${theme.isDark ? ' class="dark"' : ""}>
<head>
<meta charset="UTF-8">
${withViewport ? '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' : ""}<title>${escapeHtml(title)}</title>
<style>
:root {
  --ink-font: ${theme.fontFamily};
  --ink-bg: ${lightColors && !theme.isDark ? '#ffffff' : theme.bodyBg};
  --ink-fg: ${lightColors && !theme.isDark ? '#000000' : theme.bodyColor};
${theme.readerCss}}
${EXPORT_SHELL_CSS}
${mdBodyCss}
${theme.highlightCss}
${katexCss}
${PRINT_CSS}
</style>
</head>
<body>
<div class="markdown-body">${bodyHtml}</div>
<script>
${mermaidJs}
${mermaidInitScript(theme.isDark)}
</` + `script>
</body>
</html>`;
  }

  /**
   * 导出 HTML:单文件全内联,完全离线可打开。
   */
  async function exportHTML() {
    if (!activeTab.value) return;
    const tab = activeTab.value;
    try {
      const path = await save({
        filters: [{ name: "HTML", extensions: ["html"] }],
        defaultPath: tab.name.replace(/\.[^.]+$/, ".html"),
      });
      if (!path) return;

      const theme = captureCurrentTheme();
      const withInlinedImages = await inlineImagesInMarkdown(tab.content, tab.path);
      const { fm, body: stripped } = extractFrontMatter(withInlinedImages);
      const withToc = preprocessToc(stripped, headings.value);
      const body = renderHTMLForExport(withToc);
      const title = tab.name.replace(/\.[^.]+$/, "");

      const htmlContent = buildStandaloneHtml({
        theme,
        title,
        bodyHtml: `${renderFrontMatterCard(fm)}${body}`,
        withViewport: true,
      });
      await invoke("write_file", { path, content: htmlContent });
    } catch (err) {
      console.error("导出HTML失败:", err);
    }
  }

  /**
   * 构建隐藏 iframe 并打印纯文档内容(不含应用 chrome)。
   */
  async function printDocument(): Promise<void> {
    const tab = activeTab.value;
    if (!tab) return;

    const withImages = await inlineImagesInMarkdown(tab.content, tab.path);
    const { fm, body: stripped } = extractFrontMatter(withImages);
    const withToc = preprocessToc(stripped, headings.value);
    const bodyHtml = renderFrontMatterCard(fm) + renderHTMLForExport(withToc);
    const theme = captureCurrentTheme();
    const title = tab.name.replace(/\.[^.]+$/, "") || "文档";
    const docHtml = buildStandaloneHtml({ theme, title, bodyHtml, lightColors: true });

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'position:fixed;left:-9999px;top:0;width:0;height:0;border:0;';
    document.body.appendChild(iframe);

    // WebView2 打印"另存为 PDF"默认文件名取自主窗口 document.title(而非 iframe title),
    // 故打印前临时切换为文档名,打印后恢复
    const origDocTitle = document.title;
    document.title = title;
    try {
      const doc = iframe.contentWindow!.document;
      doc.open();
      doc.write(docHtml);
      doc.close();

      await waitForImagesAndFonts(iframe.contentWindow!);

      iframe.contentWindow!.focus();
      iframe.contentWindow!.print();
    } finally {
      document.title = origDocTitle;
      setTimeout(() => iframe.remove(), 2000);
    }
  }

  /**
   * 等待 iframe 内图片、字体加载完成。
   */
  function waitForImagesAndFonts(win: Window): Promise<void> {
    const imgPromises = Array.from(win.document.images).map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((res) => {
            img.onload = () => res();
            img.onerror = () => res();
          }),
    );
    const fontPromise = (win as any).fonts?.ready ?? Promise.resolve();
    const mermaidPromise = new Promise<void>((res) => {
      win.addEventListener('mermaid-ready', () => res(), { once: true });
      setTimeout(() => res(), 5000);
    });
    return Promise.all([...imgPromises, fontPromise, mermaidPromise]).then(() => undefined);
  }

  async function exportPDF() {
    if (!activeTab.value) return;
    if (localStorage.getItem("pdfHintShown") === "true") {
      try {
        await printDocument();
      } catch (e) {
        console.error("打印失败:", e);
      }
    } else {
      // 首次导出:先弹出说明,待用户确认后再打印
      showPrintHint.value = true;
    }
  }

  const showPrintHint = ref(false);

  async function dismissPrintHint() {
    showPrintHint.value = false;
    localStorage.setItem("pdfHintShown", "true");
    try {
      await printDocument();
    } catch (e) {
      console.error("打印失败:", e);
    }
  }

  return { showPrintHint, exportHTML, exportPDF, dismissPrintHint };
}
