/**
 * highlight.js 的 ./lib/common 导出在 package.json exports 中没有 types 条目,
 * 这里补一个声明,类型与主入口一致(仅内置 ~35 常用语言,减包)。
 */
declare module "highlight.js/lib/common" {
  import { HLJSApi } from "highlight.js";
  const hljs: HLJSApi;
  export default hljs;
}
