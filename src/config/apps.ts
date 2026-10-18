/**
 * 应用注册表 —— 全站唯一的「能点开的东西」清单
 * ================================================================
 *
 * 这个文件存在的唯一理由：**消灭四套互不相通的 id**。
 *
 * ── 它修的是什么问题 ──
 *
 *   在它出现之前，"应用"这个概念被手抄了四遍，四套 id 各不相同：
 *
 *     桌面图标（Desktop.astro）        pc / notepad / browser / …
 *     开始菜单（config/startMenu.ts）  app-notepad / recent-explorer / …
 *     磁贴（config/tiles.ts）          all-posts / calendar-live / …
 *     窗口层（WindowManager.tsx）      pc / notepad / browser / …（又一份）
 *
 *   结果是：从【开始菜单】或【磁贴】点进去的每一项，窗口层都不认识，
 *   界面上显示「未知窗口类型：recent-explorer」。
 *   只有磁贴"记事本"能用 —— 纯粹因为两边的 id 恰好都叫 notepad。
 *
 *   现在所有 id 都在这里定义一次，四处都来引用。
 *   加一个应用、改一个图标、换一个路径，只改这一个文件。
 *
 * ── 为什么 id 要短（pc 而不是 app-pc）──
 *
 *   因为 id 不只是内部标识，它会：
 *     · 变成窗口的 id（任务栏、窗口状态、去重都靠它）
 *     · 变成 URL 路径段（/archive、/posts…），刷新后靠它还原窗口
 *   短 id 让这些地方都好读。前缀（app-、recent-）是各处的历史包袱，
 *   没有实际功能，所以统一去掉。
 *
 * ⚠️ id 一旦发布就【不要改】—— 它会进 URL，用户可能已经收藏或分享。
 *    要改就得同时加一条重定向。
 */

/** 一个可以打开的应用（或外部链接） */
export interface AppDef {
  /** 唯一标识。同时是窗口类型、URL 路径段 */
  id: string;

  /**
   * 显示名在词典里的 key（如 "app.thisPC"）。
   *
   * ⚠️ 存 key 不存文案 —— 这个数组在【模块顶层】创建，
   *    那时 React 还没挂载、i18n store 还没初始化，
   *    在这里调 t() 会固化一个错误的值，之后切语言也不会重算。
   *    和 config/tiles.ts、config/startMenu.ts 是同一个套路。
   */
  nameKey: string;

  /** 图标：emoji 或 public/ 下的图片路径（判断规则见 lib/tiles.ts 的 isImageIcon） */
  icon: string;

  /**
   * 静态页路径。
   *
   * ⚠️ 必须和 src/pages/ 下的真实路由对得上 ——
   *    窗口每次打开都会把地址栏 replaceState 到它，
   *    刷新时再按这个路径把窗口还原回来。指向一个不存在的页面 = 刷新 404。
   */
  path: string;

  /**
   * 是否已经实现。
   *
   * ⚠️ 用数据标记，而不是在组件里 `if (id === "search")` 判断。
   *    理由和控制面板的 settings-sections.ts 一样：
   *    一个字段同时驱动「入口要不要显示」「点开显示什么」，
   *    就不会出现"看着能点、点开是空的"。
   *
   * 不写 = true（绝大多数应用都是已实现的，省得每行都写一遍）。
   */
  ready?: boolean;

  /**
   * 外部链接。
   *
   * ⚠️ 为 true 时点开是 window.open 新标签页，【不走窗口系统】——
   *    不会开桌面窗口，也不参与 URL 同步。
   */
  external?: boolean;

  /**
   * 只打开静态页，不进窗口系统。
   *
   * ⚠️ 为 true 时点开是 window.open(path, "_blank")：
   *    不开桌面窗口、不动地址栏、不参与窗口去重。
   *
   *    适合「这里本来就有一个完整网页」的入口 ——
   *    比如 /posts 列表页：它有自己的顶部导航、页脚、主题切换，
   *    塞进窗口里反而会丢掉这些。
   *
   * ⚠️ 和 external 的区别：
   *      external  → 跳到站外（GitHub、B站）
   *      pageOnly  → 打开站内的静态页，但不开窗口
   */
  pageOnly?: boolean;
}

/**
 * 全部应用。
 *
 * ⚠️ 顺序不重要 —— 开始菜单会自己按显示名的首字母重排（见 startMenu.ts
 *    的 buildAlphaGroups），磁贴的排列顺序由后面的分组决定。
 *    真正决定"谁出现在哪"的是下面那几个 id 列表。
 */
export const APPS: AppDef[] = [
  /* ── 有窗口的站内应用 ── */
  {
    id: "pc",
    nameKey: "app.thisPC",
    icon: "/icons/pc.png",
    path: "/archive",
  },
  {
    id: "notepad",
    nameKey: "app.notepad",
    icon: "/icons/notepad.png",
    path: "/posts",
  },
  {
    id: "browser",
    nameKey: "app.browser",
    icon: "/icons/browser.png",
    path: "/about",
  },
  {
    id: "recycle",
    nameKey: "app.recycleBin",
    icon: "/icons/recycle.png",
    path: "/drafts",
  },
  {
    id: "control",
    nameKey: "app.controlPanel",
    icon: "/icons/control.png",
    path: "/settings",
  },
  {
    id: "archive",
    nameKey: "app.archive",
    icon: "📅",
    path: "/archive",
  },
  {
    id: "tags",
    nameKey: "app.tags",
    icon: "#️⃣",
    path: "/tags",
  },
  {
    id: "about",
    nameKey: "app.aboutMe",
    icon: "👤",
    path: "/about",
  },
  {
    id: "posts",
    nameKey: "app.allPosts",
    icon: "📚",
    path: "/posts",
    /**
     * ⚠️ 这个应用有【两副面孔】，这里选的是静态页那副。
     *
     *    /posts 静态页有自己的顶部导航、页脚、主题切换，
     *    而窗口版（case "posts" → ArchiveView）没有这些。
     *    桌面图标要的是"进入那个完整页面"，所以走 pageOnly。
     *
     * ⚠️ 窗口层的 case "posts" 分支仍然保留 ——
     *    从文章列表里点「全部文章」之类的入口还会用到它。
     */
    pageOnly: true,
  },

  /* ── 还没实现的（入口保留，点开是占位页）── */
  {
    id: "search",
    nameKey: "app.search",
    icon: "🔍",
    path: "/search",
    // ⚠️ /search 这个路由【还不存在】，所以这一项打开时不会同步地址栏 ——
    //    否则用户刷新一下就撞到 404。见 WindowManager 里的说明。
    ready: false,
  },

  /* ── 外部链接 ── */
  {
    id: "github",
    nameKey: "app.github",
    icon: "🐙",
    // 换成你自己的地址
    path: "https://github.com",
    external: true,
  },
  {
    id: "bilibili",
    nameKey: "app.bilibili",
    icon: "📺",
    path: "https://www.bilibili.com",
    external: true,
  },
];

/**
 * 桌面上的图标。
 *
 * ⚠️ 顺序 = 显示顺序。网格是「先往下排、排满了才往右开新列」，
 *    所以这六项在常见屏幕上是一列排完。
 *
 * ⚠️ 屏幕矮的时候（一列放不下六个）后几个会自动排到第二列，
 *    sanitize() 会处理 —— 不会出现"图标跑到屏幕外、看不见也删不掉"。
 */
export const DESKTOP_APP_IDS = [
  "pc",
  "notepad",
  "browser",
  "recycle",
  "control",
  "posts",
];

/**
 * 开始菜单左上角「最近添加」。
 *
 * ⚠️ 这【不是】真的最近使用记录，是一份写死的固定列表。
 *    想做成真的：在 windowStore.open() 里把每次打开的 id 记进
 *    localStorage，再从这里读出来 —— 组件不用改。
 */
export const RECENT_APP_IDS = ["notepad", "pc", "control"];

/**
 * 开始菜单「所有应用」字母索引区。
 *
 * ⚠️ 这里只列 id，显示顺序由 buildAlphaGroups 按当前语言的首字母排。
 *    中文会全部归到 "#" 区，英文按 A-Z 正规分区。
 */
export const START_MENU_APP_IDS = [
  "archive",
  "about",
  "bilibili",
  "browser",
  "control",
  "github",
  "notepad",
  "posts",
  "recycle",
  "search",
  "tags",
];

/** 按 id 取应用定义。找不到返回 undefined，由调用方决定怎么降级 */
export function findApp(id: string): AppDef | undefined {
  return APPS.find((a) => a.id === id);
}

/** 按 id 列表批量取（列表里的 id 写错时会【静默跳过】—— 所以有 verify 脚本盯着） */
export function appsOf(ids: string[]): AppDef[] {
  return ids.map((id) => findApp(id)).filter((a): a is AppDef => Boolean(a));
}

/** 是不是外链。规则和 lib/tiles.ts 的 isExternal 保持一致 */
export function isExternalApp(app: AppDef): boolean {
  return app.external === true || /^https?:\/\//i.test(app.path);
}
