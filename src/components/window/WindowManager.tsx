import { useEffect, useCallback } from "react";
import { useT, t as tNow } from "../../i18n";
import type { Dict } from "../../i18n/types";
import { AnimatePresence } from "motion/react";
import { useWindowStore } from "../../store/windowStore";
import type { ClientPost } from "../../lib/markdown";
import type { Guide } from "../../lib/guide";
import {
  DEFAULT_SETTINGS_SECTION,
  findSection,
  normalizeSection,
  type SettingsSection,
} from "../../lib/settings-sections";
import { DESKTOP_APP_IDS, appsOf, findApp } from "../../config/apps";
import Window from "./Window";
import DraftsView from "./views/DraftsView";
import TagsView, { type TagInfo } from "./views/TagsView";
import AboutView, { type AboutStats } from "./views/AboutView";
import ControlPanelView from "./views/ControlPanelView";
import ExplorerView from "./views/ExplorerView";
import NotepadView from "./views/NotepadView";
import BrowserView from "./views/BrowserView";

/**
 * 与桌面图标一一对应，URL 同步和反向还原都依赖这张表。
 *
 * ⚠️ 它现在是【从应用注册表派生】的，不再是手写数据。
 *    以前这里和 Desktop.astro 的 icons 数组是两份独立清单，
 *    两边 id 不一致的表现是：双击图标派发了事件，但这里找不到同 id 的项，
 *    窗口层不知道开什么 —— 看起来像"点了没反应"。
 *    现在唯一的真相在 config/apps.ts。
 *
 * ⚠️ titleKey 存的是词典 key 而不是文案：这张表在【模块顶层】创建，
 *    那时 store 还没初始化，直接调 t() 会固化错误的值。
 *    真正的文字在 open() 的那一刻才翻译。
 */
export const ICON_ROUTES = appsOf(DESKTOP_APP_IDS).map((a) => ({
  id: a.id,
  titleKey: a.nameKey,
  icon: a.icon,
  path: a.path,
}));

/**
 * 「控制面板 - 外观」这种窗口标题。
 *
 * ⚠️ 为什么读 s.nameKey 而不是 s.name？
 *    settings-sections.ts 里的 name / desc 是【构建期定死的中文】——
 *    那份配置同时被静态页（getStaticPaths）消费，而静态页在这一版里
 *    不参与语言切换。窗口内要跟着语言走，所以用 nameKey。
 *
 * ⚠️ 用 tNow（即时读 store）而不是 useT 返回的 t：
 *    本函数会在 effect 里调用，订阅版会拿到过期的闭包。
 */
function controlTitle(s: SettingsSection): string {
  return tNow("win.controlPanelTitle", { name: tNow(s.nameKey as keyof Dict) });
}

/**
 * 「功能开发中」占位页。
 *
 * ⚠️ 它和「未知窗口类型」是两回事，别合并：
 *    这里的应用【在计划内】，只是还没做 —— 属于预期内的状态，
 *    所以文案要友善，而且不暴露任何内部标识（id、路径）。
 *
 * 样式和控制面板里未实现分类的占位页保持一致，
 * 让"还没做"这件事在全站看起来是同一个东西。
 */
function ComingSoon({ name }: { name: string }) {
  const { t } = useT();

  return (
    <div className="grid h-full min-h-[220px] place-items-center">
      <div className="text-center">
        <div className="text-[32px] leading-none opacity-40">🚧</div>
        <div className="mt-4 text-[14px] text-[var(--fg)]">{name}</div>
        <div className="mt-2 text-[12.5px] text-[var(--fg-dim)]">{t("win.comingSoon")}</div>
      </div>
    </div>
  );
}

/**
 * 用 replaceState 而不是 pushState：连点多个图标不会塞满历史记录。
 *
 * ⚠️⚠️ query 和 hash 必须清掉。
 *
 *    replaceState 的第三个参数如果是 "/settings/appearance" 这种
 *    【不带 query】的字符串，浏览器会把它当成完整的 URL 替换掉 ——
 *    原来的 ?foo=1 和 #bar 都会被丢掉。这通常是想要的效果。
 *
 *    但正因为如此，如果哪天想保留它们，就不能这么写。
 *    这里明确说明"我们是有意丢掉的"：窗口的 URL 只表达"开着哪个窗口"，
 *    搜索词、锚点属于静态页的语境，切到窗口语境下没有意义。
 */
function syncUrl(path: string) {
  if (window.location.pathname === path) return;
  window.history.replaceState({ path }, "", path);
}

/**
 * WindowManager 需要的数据。全部由 Astro 页面在构建期算好、序列化后传进来。
 *
 * ⚠️ 为什么不能在岛屿里 import getPosts？
 *    因为 getPosts 依赖 astro:content 的编译期机制，React 运行时会炸。
 *    数据只能「构建期算好 → 序列化成 props → 运行时消费」。
 */
export interface WindowManagerProps {
  posts: ClientPost[];
  drafts: ClientPost[];
  tags: TagInfo[];
  categories: TagInfo[];
  stats: AboutStats;
  /** 「使用教程」标签页的内容，来自 src/content/guide/*.md */
  guides: Guide[];
}

/** 文章窗口用的大尺寸：文章是要读的，不是要瞥一眼的 */
function articleSize() {
  if (typeof window === "undefined") return { w: 760, h: 600 };
  return {
    w: Math.min(760, window.innerWidth - 40),
    h: Math.min(600, window.innerHeight - 120),
  };
}

/**
 * 窗口管理器：整个桌面只有这一个 React 岛屿。
 *
 * ⚠️ 注意最外层这个 div。
 * Astro 的 client:only 会在外面再套一层 <astro-island>，而那一层是 0×0 的。
 * react-rnd 的 bounds="parent" 认的是「DOM 里的直接父元素」，
 * 所以这里必须自己提供一个满屏、带定位的容器，拖拽边界才算得对。
 * 少了这个 div，窗口一拖就会被钳回 (0,0) —— 这是本项目最容易踩的坑之一。
 */
export default function WindowManager({
  posts,
  drafts,
  tags,
  categories,
  stats,
  guides,
}: WindowManagerProps) {
  /**
   * 订阅语言 —— 只用它触发重渲染，不接收它的 t。
   *
   * ⚠️ 取文案统一走 tNow()（上面从 ../../i18n 直接导入的那个）。原因：
   *    本组件的文案大多在 useEffect / useCallback 里取 ——
   *      · 用订阅版的 t，闭包会一直抓着"首次渲染时的语言"，切了也不更新；
   *      · 把这个每次渲染都新建的 t 塞进依赖数组，又会让 effect
   *        每次都重跑（反复注册/注销监听器）。
   *
   *    tNow() 读的是 store 的当前值，不受闭包影响，因此可以不出现在
   *    任何依赖数组里。它唯一的代价是不具响应性 ——
   *    所以才需要这行 useT() 在语言变化时把整个窗口层重渲染一遍。
   */
  useT();

  const windows = useWindowStore((s) => s.windows);
  const open = useWindowStore((s) => s.open);

  /**
   * 按窗口 id 决定这个窗口里渲染什么。
   *
   * 这是本项目「一个岛屿管全部窗口」的关键：窗口的 id 就代表了内容类型，
   * 不需要在 store 里存组件引用 —— 那样既没法序列化，也会让 store 反过来
   * 依赖 React，把状态层和视图层搅在一起。
   *
   * id 约定：
   *   pc / notepad / browser / recycle / control  → 五个桌面图标对应的固定视图
   *   tags / about / posts                        → 兼容用，暂不挂图标
   *   post:<slug>                                 → 文章窗口（阅读排版）
   *   notepad:<slug>                              → 用记事本界面打开某篇（可看源码）
   *   control:<section>                           → 控制面板的某个分类
   *   tag:<name> / category:<name>                → 筛选视图
   *
   * ⚠️⚠️ 关于 notepad:<slug> —— 为什么"从此电脑打开文章"要换成记事本？
   *
   *    因为需求就是这样，而且它符合直觉：
   *    用户在「此电脑」里双击的是一个 .md 文件，
   *    用记事本打开一个文本文件是 Win 上最自然的联想。
   *
   *   ⚠️ 现在 post:<slug> 也走记事本了（原来它走 ArticleView）。
   *      两个入口合并成一个阅读器，理由：
   *        记事本有渲染/源码切换、居中阅读、目录、上一篇/下一篇、
   *        字号、自动换行；ArticleView 是更早的简化版，只有排版。
   *        两套阅读器并存时，同一个入口点两次可能得到两个不同的界面，
   *        用户会以为其中一个坏了。
   *
   *   ⚠️ ArticleView.tsx / ArchiveView.tsx 两个文件【保留但不再引用】——
   *      它们不参与构建（没有 import 就不会打包），
   *      以后想恢复某个入口，加一行 import 就行。
   */
  const renderContent = useCallback(
    (id: string) => {
      // ── 固定视图 ──
      switch (id) {
        // 此电脑 → 仿资源管理器：左树 + 右列表
        case "pc":
          return <ExplorerView posts={posts} />;
        // 记事本（不带 slug）→ 随机挑一篇
        case "notepad":
          return <NotepadView posts={posts} />;
        // 浏览器 → 友情链接 / 找到我 / 使用教程
        case "browser":
          return <BrowserView guides={guides} />;
        // 回收站 → 草稿箱
        case "recycle":
          return <DraftsView posts={drafts} />;
        // 控制面板（不带 section）→ 默认落到「外观」
        case "control":
          return <ControlPanelView section={DEFAULT_SETTINGS_SECTION} />;
        // 「标签」视图保留给 tag:/category: 窗口内部的跳转用，
        // 桌面上没有图标了，但文章页里的分类/标签芯片还会开它
        case "tags":
          return <TagsView tags={tags} categories={categories} posts={posts} />;
        case "about":
          return <AboutView stats={stats} />;
        // 兼容旧路径 /posts：直接进资源管理器视图
        case "posts":
          return <ExplorerView posts={posts} />;
        /*
          「归档」——从开始菜单/磁贴点进来。

          ⚠️ 用 ExplorerView（此电脑那种资源管理器界面），不是 ArchiveView。

             ArchiveView 是"按年份分组的简约列表"，只有名称和年份两列；
             ExplorerView 有工具栏、面包屑、排序表头、文件夹/列表两种视图。
             从磁贴点「归档」的人期待的是后者 —— 那是"桌面里的文件管理器"，
             不是一张时间线。

             ⚠️ ArchiveView 没有删掉，它在别处还有用；
                只是「归档」这个入口不再指向它。
        */
        case "archive":
          return <ExplorerView posts={posts} />;
        default:
          break;
      }

      /**
       * ── 记事本打开某篇：id 形如 notepad:why-win10 ──
       *
       * ⚠️ 这里打开的是【普通】记事本（可以切渲染视图）。
       *
       *    只读源码模式（回收站用的那个）走的是另一条分支，
       *    见下面 draft: 的说明 —— 两者刻意分成两个 id 前缀，
       *    因为它们在任务栏上应该是两个可以同时存在的窗口。
       *
       * ⚠️⚠️ 这个分支必须放在 post: 分支【之前】判断吗？
       *    不必须，两者的前缀不同不会互相吃掉。
       *    但顺序上先写更具体的（带冒号）是个好习惯 ——
       *    以后如果有人加一个 startsWith("note") 的模糊匹配，
       *    放前面就会把 notepad:xxx 先吃掉。
       */
      if (id.startsWith("notepad:")) {
        const slug = id.slice("notepad:".length);
        const article = [...posts, ...drafts].find((p) => p.slug === slug);
        if (!article) {
          return (
            <div className="grid h-full place-items-center text-[12px] text-[var(--fg-faint)]">
               {tNow("win.notFoundPost", { slug })}
            </div>
          );
        }
        return <NotepadView posts={posts} slug={slug} />;
      }

      /**
       * ── 只看源码的记事本：id 形如 source:formula-draft ──
       *
       * 「回收站」双击草稿走这里。
       *
       * ⚠️⚠️ 为什么用【独立的 id 前缀】，而不是给 notepad: 加个参数？
       *
       *   因为 id 决定了"这是不是同一个窗口"。
       *   如果草稿也用 notepad:<slug>，那么：
       *     从回收站双击 formula-draft  → 打开窗口 notepad:formula-draft
       *     再从此电脑双击同一篇        → 由于 id 相同，
       *                                   store 会认为是同一个窗口，
       *                                   直接聚焦而不新建 ——
       *                                   结果就是你点了个"能切渲染视图"的入口，
       *                                   却得到上次那个只读窗口
       *
       *   用不同前缀，两者就是两个独立窗口，各自的行为不会互相污染。
       *
       * ⚠️ 草稿【必须在 drafts 里找】，而且 drafts 里必须带 raw。
       *    posts 数组里没有草稿（getPosts(false) 会过滤掉），
       *    所以这里只查 drafts。
       */
      if (id.startsWith("source:")) {
        const slug = id.slice("source:".length);
        const article = drafts.find((p) => p.slug === slug);
        if (!article) {
          return (
            <div className="grid h-full place-items-center text-[12px] text-[var(--fg-faint)]">
               {tNow("win.notFoundDraft", { slug })}
            </div>
          );
        }
        /*
          ⚠️ posts 传的是【草稿自己】而不是空数组。
             因为 NotepadView 用 posts 做两件事：找当前文章、以及
             "上一篇/下一篇/随机换一篇"的候选池。
             传空数组的话，切换文章的下拉框会是空的，
             而且 article 查找会 fallback 到 posts[0] = undefined，
             直接走进"记事本里还没有内容"分支。
             传 drafts 出去，语义正好是"在草稿之间切换"。
        */
        return <NotepadView posts={drafts} slug={slug} onlySource />;
      }

      /**
       * ── 控制面板的某个分类：id 形如 control:appearance ──
       *
       * ⚠️ normalizeSection 会兜底非法值 —— URL 里被手改成一个
       *    不存在的分类时（/settings/xyz），落到默认分类，
       *    而不是显示空白面板。
       */
      if (id.startsWith("control:")) {
        return <ControlPanelView section={normalizeSection(id.slice("control:".length))} />;
      }

      // ── 文章窗口：id 形如 post:why-win10 ──
      if (id.startsWith("post:")) {
        const slug = id.slice(5);
        const article = [...posts, ...drafts].find((p) => p.slug === slug);
        /**
         * ⚠️ 用【记事本】而不是 ArticleView。
         *
         *    文章列表、此电脑、桌面快捷方式，点开文章都应该落到记事本 ——
         *    那里有渲染/源码切换、居中阅读、目录、上一篇/下一篇、
         *    字号和自动换行。ArticleView 是更早的简化版，
         *    只负责"把正文排出来"，功能和记事本差一大截。
         *
         *    两套阅读器并存的结果就是：同一个入口点了两次，
         *    一次是简版、一次是全功能版 —— 用户会以为其中一个坏了。
         */
        if (article) return <NotepadView posts={posts} slug={slug} />;
        return (
          <div className="grid h-full place-items-center text-[12px] text-[#98a1ae]">
             {tNow("win.notFoundPost", { slug })}
          </div>
        );
      }

      // ── 标签 / 分类筛选窗口 ──
      if (id.startsWith("tag:")) {
        const name = id.slice(4);
        return (
          <TagsView
            tags={tags}
            categories={categories}
            posts={posts}
            filter={name}
            filterType="tag"
          />
        );
      }
      if (id.startsWith("category:")) {
        const name = id.slice(9);
        return (
          <TagsView
            tags={tags}
            categories={categories}
            posts={posts}
            filter={name}
            filterType="category"
          />
        );
      }

      /**
       * ── 兜底 ──
       *
       * ⚠️⚠️ 分两种情况，别再混在一起（以前只有一种，而且把内部 id 漏给了用户）：
       *
       *   1. 应用【在注册表里】、只是还没做 → 显示「功能开发中…」
       *      这是预期内的状态（比如「搜索」），不该长得像出了错。
       *
       *   2. 真的不认识 → 友好提示；内部 id 只写进 console.warn。
       *      给用户看 "recent-explorer" 这种字符串没有任何帮助，
       *      只会让人以为站坏了。
       */
      const app = findApp(id);
      if (app && app.ready === false) {
        return <ComingSoon name={tNow(app.nameKey as keyof Dict)} />;
      }

      console.warn(`[windows] 未知窗口类型：${id}`);
      return (
        <div className="grid h-full place-items-center text-[12px] text-[var(--fg-faint)]">
          {tNow("win.unknownType")}
        </div>
      );
    },
    [posts, drafts, tags, categories, stats]
  );

  /**
   * 1. 桌面图标 / 各处链接（Astro 侧或视图内）→ 打开窗口。
   *
   * ⚠️ 尺寸补齐统一在 store.open() 里做（见 windowStore.ts 的 APP_SIZE）。
   *    这里只负责转发 + 同步 URL，不掺和尺寸 ——
   *    因为除这里之外，开始菜单的快捷方式也是直接调 store.open() 的，
   *    如果尺寸逻辑只写在这儿，从开始菜单打开记事本就会是默认的 480 高。
   *    凡是"所有入口都要生效"的规则，都必须放在 store 层。
   */
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.id) return;

      /**
       * ⚠️⚠️ 桌面图标的名字来自 Astro 静态 HTML 的 data-title ——
       *    那是【构建期】就写死的，不会跟着界面语言变。
       *
       *    所以这里要拿 id 回查 ICON_ROUTES 取注册名，现翻一次；
       *    查不到的（比如视图内部派发的、不在表里的 id）才退回 detail.title。
       *    少了这一步，英文界面下点桌面图标开出来的窗口标题还是中文。
       */
      const route = ICON_ROUTES.find((r) => r.id === detail.id);
      const title = route ? tNow(route.titleKey as keyof Dict) : detail.title;

      open({ ...detail, title });

      /**
       * ⚠️ 未实现的应用【不同步地址栏】。
       *
       *    因为它的 path（比如 /search）还没有对应的静态页 ——
       *    replaceState 过去之后，用户一刷新就是 404。
       *    地址栏停在原地反而是诚实的：这个窗口本来就没有地址。
       */
      const app = findApp(detail.id);
      if (app?.ready !== false) syncUrl(detail.path);
    };
    window.addEventListener("os:open-window", handler);
    return () => window.removeEventListener("os:open-window", handler);
  }, [open]);

  /**
   * 2. 列表/资源管理器内部 → 打开某篇文章。
   *
   * 为什么不让 PostList 直接调用 store？
   *   因为「开窗口」这件事必须连带做 URL 同步。如果每个组件都自己调 open()，
   *   迟早有人忘了同步 URL，浏览器地址栏就会和窗口状态对不上。
   *   统一走这个事件，URL 逻辑只写一处。
   *
   * ⚠️⚠️ detail.view 决定"用哪个外壳打开"：
   *
   *     detail.view === "notepad" → id 前缀 notepad:（记事本外壳，能看 .md 源码）
   *     其它 / 不传               → id 前缀 post:   （阅读排版外壳）
   *
   *    为什么默认是 post:（阅读视图）而不是 notepad:？
   *      因为这个事件最常从文章列表、标签页、搜索进来 ——
   *      那些场景下用户要的是"读文章"。只有从此电脑双击 .md 文件时，
   *      才由 ExplorerView 显式传 view: "notepad"。
   *
   *    ⚠️ 两种外壳的窗口 id 不同，所以【会同时开两个窗口】。
   *       这是有意的：一个是你双击 md 文件想看的源码，
   *       一个是你在列表里点了标题想读的正文，它们是两件事。
   *       想统一的话得改 id 生成规则，那会让"关掉一个不影响另一个"
   *       这个特性消失，不值得。
   *
   * ⚠️ URL 都同步成 /posts（不带 slug）。
   *    原因：notepad:<slug> 和 post:<slug> 两个窗口如果都同步成
   *    /posts/<slug>，刷新时就无法判断该还原成哪一个 —— 
   *    地址栏里那份信息不足以区分"我是用记事本开的还是用文章页开的"。
   *    与其猜，不如让 URL 只表达"我打开了文章相关的东西"，
   *    刷新后从 /posts 这个列表页重新开始，语义清晰且可预测。
   */
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.slug) return;

      /*
        ⚠️⚠️ detail.onlySource → 只读源码的记事本（回收站专用）。

           这条分支必须放在 asNotepad 判断【之前】，
           因为它和"普通记事本"用的是不同的 id 前缀，
           走同一个 id 会互相吃掉（详见 renderContent 里的说明）。

           path 同步成 /drafts 而不是 /posts：
           这个窗口是从回收站开出来的，URL 也该指回回收站 ——
           刷新页面时按路径还原，才会重新打开回收站而不是文章列表。
      */
      if (detail.onlySource) {
        const article = drafts.find((p) => p.slug === detail.slug);
        open({
          id: `source:${detail.slug}`,
          title: `${article?.title ?? detail.title ?? detail.slug}${tNow("win.readonlySuffix")}`,
          icon: "/icons/notepad.png",
          path: "/drafts",
          ...articleSize(),
        });
        syncUrl("/drafts");
        return;
      }

      const asNotepad = detail.view === "notepad";

      if (asNotepad) {
        const article = [...posts, ...drafts].find((p) => p.slug === detail.slug);
        open({
          id: `notepad:${detail.slug}`,
          // 标题加个后缀，任务栏上一眼能区分两个窗口
          title: `${article?.title ?? detail.title ?? detail.slug}`,
          icon: "/icons/notepad.png",
          path: "/posts",
          ...articleSize(),
        });
        syncUrl("/posts");
        return;
      }

      const { w, h } = articleSize();
      open({
        id: `post:${detail.slug}`,
        title: detail.title,
        icon: "📄",
        path: `/posts/${detail.slug}`,
        w,
        h,
      });
      syncUrl(`/posts/${detail.slug}`);
    };
    window.addEventListener("os:open-post", handler);
    return () => window.removeEventListener("os:open-post", handler);
  }, [open, posts, drafts]);

  /**
   * 2b. 控制面板内部点了左侧分类 → 换右侧内容 + 更新 URL 和标题。
   *
   * ⚠️ 为什么这一段必须由窗口层处理，而不是 ControlPanelView 自己改 URL？
   *
   *    因为点分类要做三件事：
   *      1. 换窗口 id（这决定右侧渲染哪个分类）
   *      2. 改 URL（可刷新、可分享）
   *      3. 改窗口标题（标题栏上应该能看到"外观 - 控制面板"）
   *
   *    第 1 条只有窗口层能做（id 是窗口层的东西）。
   *    如果让视图层只管 2、不碰 1，那么 id 不变 → 组件不重新挂载
   *    → 只能靠组件内部的 state 切换 → 但又和 URL 对不上。
   *
   *    统一收到这里，三件事一次做完，永远不会漂移。
   *
   * ⚠️⚠️ 这里没有调 open()。
   *    因为 open() 对已存在的 id 是"还原 + 置顶"，
   *    而 control:appearance → control:about 是两个不同的 id，
   *    调 open 会【再开一个新窗口】而不是在同一个窗口里切换 ——
   *    这正是需求明确禁止的行为（"不要新开窗口"）。
   *
   *    正确做法是：把当前那个 control:* 窗口的 id 和标题原地改掉。
   *    这样 React 认为是同一个 Window 组件（key 变了其实会重建，
   *    但位置、尺寸、层级都保持），视觉上就是"右侧内容换了"。
   */
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const section = normalizeSection(detail?.section);

      const store = useWindowStore.getState();
      // 找当前开着的控制面板（不论它是哪个分类）
      const panel = store.windows.find((w) => w.id === "control" || w.id.startsWith("control:"));
      if (!panel) return;

      const s = findSection(section);
      /**
       * 原地改 id —— 内容会跟着变，但窗口的几何/层级不动。
       *
       * ⚠️⚠️ 这里【故意没有】动 uid，这是修复本次 bug 的关键。
       *
       *   改 id 是"这个窗口现在显示什么"，会触发右侧内容重渲染；
       *   不动 uid 是"这个窗口还是刚才那一个"，AnimatePresence
       *   因此不会误以为"旧窗口关了、新窗口开了"。
       *
       *   如果这里顺手把 uid 也改了（比如写成 uid: nextUid()），
       *   就会回到修之前的状态：切分类时窗口会重播一次开窗动画，
       *   而且在动画中途关窗会留下关不掉的僵尸节点。
       *
       *   ⚠️ 用展开运算符 ...w 就自动保留了 uid。别改成逐个字段列举 ——
       *      那样以后 store 里加字段，这里就会悄悄漏掉。
       */
      useWindowStore.setState({
        windows: store.windows.map((w) =>
          w.uid === panel.uid ? { ...w, id: `control:${section}`, title: controlTitle(s) } : w
        ),
      });

      syncUrl(`/settings/${section}`);
    };
    window.addEventListener("os:switch-settings", handler);
    return () => window.removeEventListener("os:switch-settings", handler);
  }, []);

  /**
   * 3. 直接带着 /posts/why-win10 这类路径进站时，自动还原对应窗口。
   *
   * 这一步是 SEO 和体验的接合点：
   *   爬虫 / 新标签页直接访问 → 看到的是完整静态 HTML
   *   站内导航进来           → 立刻变成桌面上的一个窗口
   * 两者用的是同一个 URL，呈现方式按场景各不相同 —— 这就是
   * 「静态页面 + 窗口化」这个方案的全部意义。
   */
  useEffect(() => {
    const path = decodeURIComponent(window.location.pathname);

    // /posts/<slug>
    const postMatch = path.match(/^\/posts\/(.+)$/);
    if (postMatch) {
      const slug = postMatch[1];
      const article = [...posts, ...drafts].find((p) => p.slug === slug);
      if (article) {
        open({
          id: `post:${slug}`,
          title: article.title,
          icon: "📄",
          path,
          ...articleSize(),
        });
        return;
      }
    }

    // /tags/<tag>
    const tagMatch = path.match(/^\/tags\/(.+)$/);
    if (tagMatch) {
      open({ id: `tag:${tagMatch[1]}`, title: tNow("win.tagTitle", { name: tagMatch[1] }), icon: "🏷️", path });
      return;
    }

    // /category/<cat>
    const catMatch = path.match(/^\/category\/(.+)$/);
    if (catMatch) {
      open({
        id: `category:${catMatch[1]}`,
        title: tNow("win.categoryTitle", { name: catMatch[1] }),
        icon: "🏷️",
        path,
      });
      return;
    }

    /**
     * ⚠️⚠️ 控制面板分类：/settings/<section>
     *
     *    这个分支【必须放在下面的固定路径查找之前】。
     *
     *    因为下面的 ICON_ROUTES.find(r => r.path === path) 用的是
     *    【全等】匹配，"/settings/appearance" 不等于 "/settings"，
     *    所以它本来也匹配不上 —— 但那样就会直接掉到末尾什么都不开，
     *    用户从收藏夹打开 /settings/appearance 会看到一个空桌面。
     *
     *    这里用正则专门处理带分类的情况。
     *
     *    ⚠️ 为什么不用全等？因为分类是动态的（今天 4 个，明天可能 6 个），
     *       写死一张表就得跟着改。用前缀 + normalizeSection 兜底，
     *       以后往 SETTINGS_SECTIONS 里加一项就自动可用。
     */
    const settingsMatch = path.match(/^\/settings\/([^/]+)\/?$/);
    if (settingsMatch) {
      const section = normalizeSection(decodeURIComponent(settingsMatch[1]));
      const s = findSection(section);
      open({
        id: `control:${section}`,
        title: controlTitle(s),
        icon: "/icons/control.png",
        path,
      });
      return;
    }

    // 固定图标路径
    const match = ICON_ROUTES.find((r) => r.path === path);
    if (match) {
      /**
       * ⚠️ control 这个图标打开时要带上默认分类，否则 id 是裸的 "control"，
       *    渲染出来是默认分类，但用户点左侧导航后 id 会变成 control:xxx ——
       *    从"裸 id"到"带分类 id"这一步也是原地改，没问题。
       *    这里统一成带分类的 id，让"控制面板窗口的 id 永远是 control:*"
       *    成为一条不变式，少一种状态就少一类 bug。
       */
      if (match.id === "control") {
        const s = findSection(DEFAULT_SETTINGS_SECTION);
        open({ ...match, id: `control:${s.id}`, title: controlTitle(s) });
        return;
      }
      /**
       * ⚠️ ICON_ROUTES 里存的是 titleKey，而 open() 要的是 title ——
       *    所以必须显式翻译一次，不能像以前那样直接把 match 丢进去，
       *    否则窗口标题会变成 "app.thisPC" 这种注册名。
       */
      open({ ...match, title: tNow(match.titleKey as keyof Dict) });
    }
    // ⚠️ 这个 effect 只在挂载时跑一次（有意为之）。
    // 如果依赖 posts/drafts，每次数据变化都会重新还原窗口，
    // 把用户已经关掉的窗口又弹回来。下面的数组是刻意留空的。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /**
   * 4. 浏览器前进/后退时，窗口跟着变。
   *
   * 注意我们用 replaceState 的地方不会产生历史记录，所以这个监听主要服务
   * 「用户自己按了后退」和「从静态页跳回来」这两种情况。
   * 没有匹配到任何路径时，关掉所有窗口回到干净桌面。
   */
  useEffect(() => {
    const onPop = () => {
      const path = decodeURIComponent(window.location.pathname);

      const postMatch = path.match(/^\/posts\/(.+)$/);
      if (postMatch) {
        const article = [...posts, ...drafts].find((p) => p.slug === postMatch[1]);
        if (article) {
          open({
            id: `post:${postMatch[1]}`,
            title: article.title,
            icon: "📄",
            path,
            ...articleSize(),
          });
          return;
        }
      }

      const tagMatch = path.match(/^\/tags\/(.+)$/);
      if (tagMatch) {
        open({ id: `tag:${tagMatch[1]}`, title: tNow("win.tagTitle", { name: tagMatch[1] }), icon: "🏷️", path });
        return;
      }

      const catMatch = path.match(/^\/category\/(.+)$/);
      if (catMatch) {
        open({
          id: `category:${catMatch[1]}`,
          title: tNow("win.categoryTitle", { name: catMatch[1] }),
          icon: "🏷️",
          path,
        });
        return;
      }

      /**
       * ⚠️ popstate 里也要处理 /settings/<section>，和上面的初次还原是
       *    【对称】的。漏掉的症状很具体：
       *    用户在控制面板里点了「更新日志」（URL 变成 /settings/changelog），
       *    然后按浏览器后退 → 地址栏回到 /settings/appearance
       *    → 但窗口没有任何反应（因为这里没匹配到）
       *    → 地址栏和界面不一致了。
       */
      const settingsMatch = path.match(/^\/settings\/([^/]+)\/?$/);
      if (settingsMatch) {
        const section = normalizeSection(decodeURIComponent(settingsMatch[1]));
        const s = findSection(section);
        open({
          id: `control:${section}`,
          title: controlTitle(s),
          icon: "/icons/control.png",
          path,
        });
        return;
      }

      const match = ICON_ROUTES.find((r) => r.path === path);
      if (match) {
        if (match.id === "control") {
          const s = findSection(DEFAULT_SETTINGS_SECTION);
          open({ ...match, id: `control:${s.id}`, title: controlTitle(s) });
          return;
        }
        open({ ...match, title: tNow(match.titleKey as keyof Dict) });
      } else {
        useWindowStore.setState({ windows: [] });
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [open, posts, drafts]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {/*
        ⚠️ AnimatePresence 是窗口【关闭动画】能播出来的前提。

        默认情况下，store 里一删掉窗口，React 立刻就把这个 Window 卸载了，
        DOM 瞬间消失 —— 退出动画根本没机会执行。

        AnimatePresence 会接管「子元素被移除」这个时机：
        它保留该元素直到其 exit 动画播完，再真正从 DOM 摘掉。
        子元素需要在被移除的那个瞬间仍然是「已挂载」的状态，
        这就需要它带一个稳定的 key（我们已经有了 w.id）。

        mode 用默认值（sync）而不是 "wait"：
        "wait" 会让新窗口等旧窗口动画播完才出现，
        多窗口同时开关时会出现明显延迟，不符合桌面系统的直觉。
      */}
      <AnimatePresence initial={false}>
        {windows.map((w) => (
          /*
            ⚠️⚠️ key 必须用 w.uid，【不能】用 w.id。

               id 是会变的（控制面板切分类时原地改），
               而 key 一变，AnimatePresence 就认为"这是另一个窗口了"：
                 · 给旧 key 启动退出动画（缩小 + 淡出）
                 · 给新 key 挂一个进场动画
               于是同一个窗口同时跑着两套动画。

               症状（难查，要卡在几百毫秒的动画窗口里操作）：
                 动画没播完时点关闭 → 任务栏按钮没了，窗口还画在屏幕上；
                 拖那个残留窗口会弹回原位。

               换成创建后永不改变的 uid，切分类时 key 不变，
               AnimatePresence 就不会误判 —— 右侧内容照样会刷新，
               那是由 renderContent(w.id) 驱动的，和 key 是两回事。
          */
          <Window key={w.uid} win={w}>
            {renderContent(w.id)}
          </Window>
        ))}
      </AnimatePresence>
    </div>
  );
}
