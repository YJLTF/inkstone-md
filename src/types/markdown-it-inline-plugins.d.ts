// markdown-it-mark / markdown-it-sub / markdown-it-sup 均为无类型的迷你插件,
// 用法一致:md.use(plugin) 即可,无需配置项。
declare module 'markdown-it-mark' {
  import type { PluginSimple } from 'markdown-it';
  const mark: PluginSimple;
  export default mark;
}

declare module 'markdown-it-sub' {
  import type { PluginSimple } from 'markdown-it';
  const sub: PluginSimple;
  export default sub;
}

declare module 'markdown-it-sup' {
  import type { PluginSimple } from 'markdown-it';
  const sup: PluginSimple;
  export default sup;
}
