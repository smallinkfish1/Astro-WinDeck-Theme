import { create } from "zustand";
import { zhCN } from "./zh-CN";
import { en } from "./en";
import { HTML_LANG, LANGS, type DictMap, type Lang } from "./types";

/**
 * 语言状态
 * ================================================================
 *
 * ── 为什么是 zustand，而不是 React Context？ ──
 *
 *   ⚠️⚠️ 这是本功能最关键的一个技术决定，先说清楚。
 *
 *   这个博客的桌面由【两个独立的 React 岛屿】组成：
 *
 *       <WindowManager client:only="react" />   ← 窗口、各视图
 *       <Taskbar       client:only="react" />   ← 任务栏、开始菜单
 *
 *   它们在 HTML 里是两个分开的 <astro-island> 节点，
 *   中间隔着的全是 Astro 生成的静态 HTML。
 *
 *   React Context 只能沿着【React 组件树】往下传。
 *   而这两棵树之间没有父子关系 —— 它们各自从自己的 island 根节点开始。
 *   所以用 Context 的话，Taskbar 根本读不到 WindowManager 里的 Provider，
 *   切语言时任务栏会无动于衷。
 *
 *   zustand 是模块级的全局单例：不管有几棵树、隔着多少 HTML，
 *   大家 import 的是同一个 store 对象。这就是它能"穿墙"的原因。
 *
 * ── 为什么不用 /en/ 路由？ ──
 *
 *   路由方案（每换一种语言就换一个 URL）对 SEO 友好，
 *   但代价是【整页重新加载】：用户正开着五个窗口、记事本里读着
 *   第 3 篇，切个语言全没了，回到干净桌面。
 *   桌面 OS 的隐喻里，这体验是崩的 —— 它不像"设置里改语言"，
 *   更像"电脑重启了"。
 *
 *   所以第一版选运行时字典：不刷新、不丢状态。
 *   静态页（/posts/xxx 这些）不参与切换，见语言页里的说明。
 */

/**
 * 存储键。和项目其它设置一样加统一前缀，避免和别的站点撞车。
 *
 * ⚠️ 这里【导出】它们，是为了让 DesktopLayout.astro 的 <head> 内联脚本
 *    也能用到同一个字符串。那段脚本必须自包含（它在模块加载之前就要跑完，
 *    否则桌面图标会先渲染中文、再闪成英文），没法 import 这里的值 ——
 *    所以由布局文件把这个常量注入进去，保证两边不会各写一份。
 */
export const KEY_LANG = "win10-blog:lang";
export const KEY_REGIONAL = "win10-blog:regional";
export const KEY_HOUR24 = "win10-blog:hour24";

/**
 * 两本词典。
 *
 * ⚠️ 这里用 satisfies 而不是直接写 DictMap 类型注解 ——
 *    效果是"既要满足 DictMap 的约束，又保留字面量的精确 key"。
 *    但因为我们已经在 zh-CN.ts / en.ts 里显式标注了 DictMap，
 *    漏 key 的检查在那里就完成了，这里只是把两本装进一个查找表。
 */
const DICTS: Record<Lang, DictMap> = {
  "zh-CN": zhCN,
  en,
};

/** 默认语言。中文站，默认中文 */
const DEFAULT_LANG: Lang = "zh-CN";

/**
 * 从 localStorage 读语言。
 *
 * ⚠️ 必须做白名单校验。
 *    localStorage 里的值是可以被用户手改的（或者被旧版本写入过）。
 *    如果直接拿来当 key 去查 DICTS，改坏了就会拿到 undefined，
 *    然后整个界面渲染时炸在 t() 里。
 *    不在合法列表里就退回默认 —— 降级永远比崩溃好。
 */
function readLang(): Lang {
  if (typeof localStorage === "undefined") return DEFAULT_LANG;
  const raw = localStorage.getItem(KEY_LANG);
  return LANGS.includes(raw as Lang) ? (raw as Lang) : DEFAULT_LANG;
}

/**
 * 地区格式开关。
 *
 * ⚠️ 默认【关】。也就是即使切到英文，日期也还是中文格式 ——
 *    除非用户主动打开。理由：
 *      语言和地区在真实 Windows 里本来就是两个独立设置
 *      （有人用英文界面但中国区日期，也有人反过来）。
 *      把它们耦合在一起，等于替用户做了决定。
 *
 *    存成一个布尔值而不是 "auto"/"manual" 三态：
 *      第一版只有两档，三态是过度设计。
 */
function readRegional(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(KEY_REGIONAL) === "on";
}

/**
 * 24 小时制开关。
 *
 * ⚠️ 默认【关】= 12 小时制，任务栏显示 10:24 PM。
 *
 *    为什么默认 12 小时：这是控制面板里明确给用户的默认值，
 *    和 Windows 10 英文版的初始状态一致（中文版默认 24 小时）。
 *    想用 24 小时制的自己打开，一个开关的事。
 *
 * ⚠️ 和「地区格式」是两个独立开关，别合并。
 *    真实 Windows 里「时间格式」和「地区」也分得开：
 *    有人用英文界面 + 24 小时制，也有人反过来。
 */
function readHour24(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(KEY_HOUR24) === "on";
}

interface I18nStore {
  /** 当前界面语言 */
  lang: Lang;
  /** 地区格式是否跟随语言（false = 固定中文格式） */
  regional: boolean;
  /** 是否用 24 小时制（false = 12 小时制，显示 10:24 PM） */
  hour24: boolean;
  /** 切换语言 */
  setLang: (lang: Lang) => void;
  /** 开关地区格式 */
  setRegional: (on: boolean) => void;
  /** 开关 24 小时制 */
  setHour24: (on: boolean) => void;
}

export const useI18nStore = create<I18nStore>((set) => ({
  /**
   * ⚠️ 初始值【不能】在模块顶层读 localStorage。
   *
   *    这个模块在构建期（Node）和运行期（浏览器）都会被加载。
   *    构建期没有 localStorage，读它会直接抛错，把整个构建搞挂。
   *    readLang() 里已经做了 typeof 判断，但更稳妥的做法是：
   *    初值给默认值，真实值在客户端的 useEffect 里同步进来
   *    （见 index.ts 的 useSyncI18n）。
   *
   *    这和 useAppearance 处理主题的思路完全一致 ——
   *    服务端渲染时给一个"安全的默认值"，客户端挂载后再校正。
   */
  lang: DEFAULT_LANG,
  regional: false,
  hour24: false,

  setLang: (lang) => {
    set({ lang });
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY_LANG, lang);
    /**
     * ⚠️ 同步 <html lang>。
     *
     *    这一行不能省。它是给两类"读者"看的：
     *      · 搜索引擎 —— 判断这个页面是什么语言
     *      · 屏幕阅读器 —— 决定用哪种发音来念
     *
     *    切开英文但不改 <html lang>，会变成一篇用英文写、
     *    却标着"我是中文"的页面 —— 读屏软件会用中文音去念英文单词，
     *    完全听不懂。
     */
    if (typeof document !== "undefined") {
      document.documentElement.lang = HTML_LANG[lang];
    }
  },

  setRegional: (on) => {
    set({ regional: on });
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(KEY_REGIONAL, on ? "on" : "off");
    }
  },

  setHour24: (on) => {
    set({ hour24: on });
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(KEY_HOUR24, on ? "on" : "off");
    }
  },
}));

/**
 * 给非 React 场景用的读取函数。
 *
 * ⚠️ 什么时候需要它？
 *    当代码不在组件里、不能调用 hook 的时候 —— 比如事件处理器的
 *    最外层、或者某个纯函数想拿当前语言。
 *
 * ⚠️ 但它【不是响应式】的：读到的永远是"此刻"的值。
 *    在 React 组件里请一律用 useT() —— 那样语言一变组件会重渲染，
 *    用这个函数读了之后不会自动更新。
 */
export function readLangFromStore(): Lang {
  return useI18nStore.getState().lang;
}

export function readRegionalFromStore(): boolean {
  return useI18nStore.getState().regional;
}

export function readHour24FromStore(): boolean {
  return useI18nStore.getState().hour24;
}

/** 供 index.ts 在客户端挂载时调用，把 localStorage 里的真实值同步进来 */
export function hydrateI18n() {
  const lang = readLang();
  const regional = readRegional();
  const hour24 = readHour24();
  useI18nStore.setState({ lang, regional, hour24 });
  if (typeof document !== "undefined") {
    document.documentElement.lang = HTML_LANG[lang];
  }
}

/**
 * 取词典（给 t() 用）。
 *
 * ⚠️ 不做缓存。词典是模块级常量，DICTS[lang] 就是一次对象属性访问，
 *    比任何缓存的判断还快。加缓存只会引入"缓存失效"这一类 bug。
 */
export function dictOf(lang: Lang): DictMap {
  return DICTS[lang];
}
