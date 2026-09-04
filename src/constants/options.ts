import type { ThemeOption } from '../types';
import hljsLightCss from "highlight.js/styles/github.css?raw";
import hljsDarkCss from "highlight.js/styles/github-dark.css?raw";
import hljsAtomOneLightCss from "highlight.js/styles/atom-one-light.css?raw";
import hljsAtomOneDarkCss from "highlight.js/styles/atom-one-dark.css?raw";
import hljsVs2015Css from "highlight.js/styles/vs2015.css?raw";
import hljsNordCss from "highlight.js/styles/nord.css?raw";
import hljsGithubDimmedCss from "highlight.js/styles/github-dark-dimmed.css?raw";

// ========= 主题选项 =========
export const THEME_OPTIONS: ThemeOption[] = [
  { value: "inkstone", label: "InkStone" },
  { value: "github", label: "GitHub" },
  { value: "onedark", label: "One Dark", forceDark: true },
  { value: "typora", label: "Typora" },
];

// ========= 代码高亮主题 =========
// 预览动态注入 <style id="ink-hljs-theme">;auto = 跟随亮暗选 github 系
const HLJS_THEME_CSS: Record<string, string> = {
  "github-light": hljsLightCss,
  "github-dark": hljsDarkCss,
  "github-dark-dimmed": hljsGithubDimmedCss,
  "atom-one-light": hljsAtomOneLightCss,
  "atom-one-dark": hljsAtomOneDarkCss,
  "vs2015": hljsVs2015Css,
  "nord": hljsNordCss,
};

export const HLJS_THEME_OPTIONS: { value: string; label: string }[] = [
  { value: "auto", label: "自动" },
  { value: "github-light", label: "GitHub 亮" },
  { value: "github-dark", label: "GitHub 暗" },
  { value: "github-dark-dimmed", label: "Dimmed" },
  { value: "atom-one-light", label: "Atom 亮" },
  { value: "atom-one-dark", label: "Atom 暗" },
  { value: "vs2015", label: "VS2015" },
  { value: "nord", label: "Nord" },
];

/** 按阅读偏好解析实际生效的高亮主题 CSS;auto/非法值回退到亮暗自适应 */
export function getHljsThemeCss(pref: string, dark: boolean): string {
  const key = pref === "auto" || !HLJS_THEME_CSS[pref]
    ? (dark ? "github-dark" : "github-light")
    : pref;
  return HLJS_THEME_CSS[key];
}

// ========= 阅读偏好字体栈 =========
export const FONT_STACKS: Record<string, string> = {
  sans: `'Segoe UI', system-ui, -apple-system, 'Microsoft YaHei', 'PingFang SC', sans-serif`,
  serif: `'Georgia', 'Cambria', 'Source Serif Pro', 'Times New Roman', 'SimSun', 'Songti SC', serif`,
};
