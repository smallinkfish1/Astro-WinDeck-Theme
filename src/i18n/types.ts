/**
 * 双语词典的类型契约
 * ================================================================
 *
 * 这个文件是整个多语言功能的地基，它只做一件事：
 *   **把「有哪些文案」钉死成一份类型**。
 *
 * ── 为什么值得单开一个文件？ ──
 *
 *   中英两本词典如果各写各的，迟早会漂移：
 *   中文加了新词条、英文忘了加 —— 切到英文时那一句就变成
 *   空白 / undefined / 或直接是中文 key，而浏览器不报错。
 *   这种 bug 只有在「切到英文 + 恰好走到那个界面」时才会被发现，
 *   平时测试根本撞不到。
 *
 *   解法：让两本词典都声明成 `DictMap`。
 *   只要少一条 key，`astro check` / tsc 立刻报错，
 *   根本进不了构建产物 —— 把「运行时才发现的漏翻」
 *   提前成了「编译期就发现的错误」。
 *
 * ── 为什么不用 string 索引签名？ ──
 *
 *   如果写成 `Record<string, string>`，那就等于什么都没约束：
 *   任何 key 都能塞进去，漏了也查不出来，拼错了也查不出来。
 *   必须把 315 条一条条列成具名属性，类型系统才有东西可校验。
 *
 * ⚠️ 改这个文件时要知道自己在做什么：
 *    在这里加一条 key，会【同时】要求 zh-CN.ts 和 en.ts 各补一条，
 *    否则编译器会指着那两个文件报错。这是设计意图，不是 bug。
 */

/**
 * 全部界面文案。key 的命名规则：
 *
 *   app.*        应用名（桌面图标 / 任务栏 / 开始菜单 / 窗口标题共用）
 *   win.*        窗口控件（最小化 / 最大化 / 关闭…）
 *   taskbar.*    任务栏自身的文字
 *   menu.*       开始菜单的固定文字
 *   ex.*         此电脑 / 回收站（文件管理器）
 *   np.*         记事本
 *   bv.*         浏览器
 *   cp.*         控制面板
 *   about.*      关于视图
 *   post.*       文章列表 / 归档 / 标签视图
 *   stats.*      站点统计的标签
 *   site.*       站点自身（简介、社交链接的注释）
 *   tile.*       开始菜单磁贴与分组标题
 *   toc.*        文章目录（正文右侧那个）
 *   wallpaper.*  壁纸名称
 *   time.*       日期时间相关（星期、相对时间）
 *   unit.*       量词（篇 / 个 / 约…）
 *   lang.*       语言设置区块自身
 *
 * ⚠️ 带 {占位符} 的条目不写死内容，由 t(key, { n: 3 }) 注入。
 *    「共 3 个项目」这种句子如果拆成两段拼，语序一变就散了 ——
 *    必须让整句作为一个整体，占位符留在里面。
 */
export interface Dict {
  /* ── 应用名 ── */
  "app.thisPC": string;
  "app.notepad": string;
  "app.browser": string;
  "app.recycleBin": string;
  "app.controlPanel": string;
  "app.tags": string;
  "app.about": string;
  "app.archive": string;
  "app.posts": string;
  /** 桌面图标用的名字 —— 它打开的是 /posts 静态页，不是窗口 */
  "app.allPosts": string;
  "app.search": string;
  "app.bilibili": string;
  "app.github": string;
  "app.photos": string;
  "app.aboutMe": string;

  /* ── 窗口控件 ── */
  "win.minimize": string;
  "win.maximize": string;
  "win.restore": string;
  "win.close": string;
  "win.emptyTitle": string;
  "win.emptyBody": string;
  "win.emptyPath": string;
  "win.notFoundPost": string;
  "win.notFoundDraft": string;
  "win.unknownType": string;
  "win.comingSoon": string;
  "win.readonlySuffix": string;
  "win.tagTitle": string;
  "win.categoryTitle": string;
  "win.controlPanelTitle": string;

  /* ── 任务栏 ── */
  "taskbar.start": string;
  "taskbar.showDesktop": string;
  /** 时间区域的 aria-label —— 它现在是个按钮，点了会弹日历 */
  "taskbar.openCalendar": string;

  /* ── 开始菜单 ── */
  "menu.recentlyAdded": string;
  "menu.expand": string;
  "menu.collapse": string;
  "menu.tileCount": string;
  "menu.tileCountHint": string;

  /*
   * ── 日历面板 ──
   *
   * ⚠️ 这里只有【界面】文案。农历日名、节气名、节日名都不在词典里 ——
   *    它们直接来自 lunar-typescript 的中文输出，切英文时也保持中文。
   *    这是产品决定，不是漏翻（见 lib/lunar.ts 顶部说明）。
   */
  "cal.aria": string;
  "cal.today": string;
  "cal.prevMonth": string;
  "cal.nextMonth": string;
  /** 底部摘要。{text} 是「农历九月初七 · 丙午年」这种中文串 */
  "cal.todaySummary": string;

  /* ── 此电脑 / 回收站（文件管理器外壳） ── */
  "ex.new": string;
  "ex.share": string;
  "ex.delete": string;
  "ex.viewFolder": string;
  "ex.viewList": string;
  "ex.viewFolderTip": string;
  "ex.viewListTip": string;
  "ex.back": string;
  "ex.search": string;
  "ex.searchTip": string;
  "ex.allItems": string;
  "ex.itemCount": string;
  "ex.selected": string;
  "ex.doubleClickOpen": string;
  "ex.emptyFolder": string;
  "ex.folder": string;
  "ex.uncategorized": string;
  "ex.name": string;
  "ex.type": string;
  "ex.dateModified": string;
  "ex.sortTip": string;
  "ex.demoOnly": string;
  "ex.noPosts": string;
  "ex.draftCount": string;
  "ex.recycleEmpty": string;
  "ex.postKind": string;
  "ex.draftKind": string;

  /* ── 记事本 ── */
  "np.file": string;
  "np.new": string;
  "np.openStatic": string;
  "np.exit": string;
  "np.edit": string;
  "np.selectAll": string;
  "np.copy": string;
  "np.find": string;
  "np.format": string;
  "np.wordWrap": string;
  "np.wordWrapOff": string;
  "np.font": string;
  "np.view": string;
  "np.renderedView": string;
  "np.sourceView": string;
  "np.prev": string;
  "np.next": string;
  "np.random": string;
  "np.help": string;
  "np.aboutNotepad": string;
  "np.switchArticle": string;
  "np.empty": string;
  "np.readonly": string;
  "np.readonlyTip": string;
  "np.readonlyAria": string;
  "np.markdownAria": string;
  "np.toggleTip": string;
  "np.toggleTipNormal": string;
  "np.lineCol": string;
  "np.reading": string;
  "np.bytes": string;
  "np.renderedViewShort": string;
  "np.sourceViewShort": string;
  /** 「查看」菜单里的居中阅读开关 */
  "np.centerReading": string;

  /* ── 浏览器 ── */
  "bv.back": string;
  "bv.forward": string;
  "bv.refresh": string;
  "bv.address": string;
  "bv.favorite": string;
  "bv.newTab": string;
  "bv.statusBar": string;
  "bv.noFriendLinks": string;
  "bv.friendHint": string;
  "bv.noSocials": string;
  "bv.socialHint": string;
  "bv.toc": string;
  "bv.noGuides": string;
  "bv.noGuidesHint": string;
  "bv.tab.links": string;
  "bv.tab.social": string;
  "bv.tab.guide": string;
  "bv.tab.linksDesc": string;
  "bv.tab.socialDesc": string;
  "bv.tab.guideDesc": string;

  /* ── 控制面板 ── */
  "cp.title": string;
  "cp.navAria": string;
  "cp.savedLocally": string;
  "cp.inDevelopment": string;
  "cp.nav.appearance": string;
  "cp.nav.about": string;
  "cp.nav.language": string;
  "cp.nav.changelog": string;
  "cp.desc.appearance": string;
  "cp.desc.about": string;
  "cp.desc.language": string;
  "cp.desc.changelog": string;
  "cp.appearance.lead": string;
  "cp.wallpaper": string;
  "cp.colors": string;
  "cp.appMode": string;
  "cp.appModeDesc": string;
  "cp.light": string;
  "cp.dark": string;
  "cp.startMenuDark": string;
  "cp.startMenuDarkDesc": string;
  "cp.effects": string;
  "cp.acrylic": string;
  "cp.acrylicDesc": string;
  "cp.anim": string;
  "cp.animDesc": string;
  "cp.reset": string;
  "cp.resetHint": string;
  "cp.aboutLead": string;
  "cp.overview": string;
  "cp.notes": string;
  "cp.kb.position": string;
  "cp.kb.stack": string;
  "cp.kb.theming": string;
  "cp.kb.render": string;
  "cp.kb.data": string;
  "cp.v.position": string;
  "cp.v.stack": string;
  "cp.v.theming": string;
  "cp.v.render": string;
  "cp.v.data": string;
  "cp.note1": string;
  "cp.note2": string;
  "cp.note3": string;
  "cp.wallpaperMissing": string;
  "cp.wallpaperPending": string;
  "cp.wallpaperNotReady": string;
  "cp.wallpaperHint": string;

  /* ── 语言和区域 ── */
  "lang.title": string;
  "lang.lead": string;
  "lang.displayLanguage": string;
  "lang.displayLanguageDesc": string;
  "lang.regionalFormat": string;
  "lang.regionalFormatDesc": string;
  "lang.regionalOn": string;
  "lang.regionalOff": string;
  /** 24 小时制开关（默认关 = 12 小时制） */
  "lang.hour24": string;
  "lang.hour24Desc": string;
  "lang.note1": string;
  "lang.note2": string;
  "lang.note3": string;

  /* ── 文章目录（TOC） ── */
  "toc.title": string;
  "toc.aria": string;
  "toc.expand": string;
  "toc.collapse": string;

  /* ── 关于视图 ── */
  "about.stats": string;
  "about.findMe": string;
  "about.stack": string;
  "about.stackNote": string;
  "about.recentlyUpdated": string;
  "about.avatarAlt": string;

  /* ── 文章列表 / 归档 / 标签 ── */
  "post.allPosts": string;
  "post.filterPlaceholder": string;
  "post.noPosts": string;
  "post.noMatch": string;
  "post.noSummary": string;
  "post.count": string;
  "post.staticPage": string;
  "post.footerTip": string;
  "post.dateLabel": string;
  "post.categoryLabel": string;
  "post.openAria": string;
  "post.ctrlClickTip": string;
  "post.hasStaticPage": string;
  "archive.empty": string;
  "archive.footer": string;
  "archive.yearUnit": string;
  "archive.monthUnit": string;
  "tags.cloud": string;
  "tags.categories": string;
  "tags.noPosts": string;
  "tags.postCount": string;
  "tags.tagCount": string;
  "tags.categoryCount": string;

  /* ── 站点统计 ── */
  "stats.posts": string;
  "stats.categories": string;
  "stats.tags": string;
  "stats.words": string;

  /* ── 量词 ── */
  "unit.post": string;
  "unit.item": string;
  "unit.itemShort": string;
  "unit.tag": string;
  "unit.category": string;
  "unit.words": string;
  "unit.about": string;

  /* ── 站点自身 ── */
  "site.profileName": string;
  "site.bio1": string;
  "site.bio2": string;
  "site.note.source": string;
  "site.note.subscribe": string;
  "site.note.contact": string;
  "site.note.sitemap": string;
  "site.note.video": string;
  "site.note.channel": string;
  "site.note.community": string;
  "site.note.moments": string;
  "site.note.oldAccount": string;

  /* ── 时间 ── */
  "time.sunday": string;
  "time.monday": string;
  "time.tuesday": string;
  "time.wednesday": string;
  "time.thursday": string;
  "time.friday": string;
  "time.saturday": string;
  "time.justNow": string;
  "time.minutesAgo": string;
  "time.hoursAgo": string;
  "time.daysAgo": string;
  "time.readingTime": string;

  /* ── 磁贴 ── */
  "tile.group.create": string;
  "tile.group.play": string;
  "tile.group.explore": string;
  "tile.external": string;
  "tile.weather.cloudy": string;
  "tile.weather.placeholder": string;

  /* ── 桌面图标 / 右键菜单 / 快捷方式 ── */
  "dk.menuAria": string;
  /** 右键菜单「查看」子菜单 */
  "dk.view": string;
  "dk.sizeLarge": string;
  "dk.sizeMedium": string;
  "dk.sizeSmall": string;
  "dk.showIcons": string;
  "dk.personalize": string;
  "dk.refresh": string;
  "dk.newPost": string;
  "dk.newUrl": string;
  "dk.arrange": string;
  "dk.reset": string;
  "dk.delete": string;
  "dk.modalTitle": string;
  "dk.tabPost": string;
  "dk.tabUrl": string;
  "dk.pickPost": string;
  "dk.searchPost": string;
  "dk.noPostFound": string;
  "dk.willCreate": string;
  "dk.urlLabel": string;
  "dk.urlInvalid": string;
  "dk.urlName": string;
  "dk.urlNamePlaceholder": string;
  "dk.urlNameHint": string;
  "dk.alreadyExists": string;
  "dk.cancel": string;
  "dk.confirm": string;

  /* ── 壁纸名 ── */
  "wallpaper.default": string;
  "wallpaper.aurora": string;
  "wallpaper.mountain": string;
  "wallpaper.geometric": string;
}

/**
 * 两本词典都必须满足的类型。
 *
 * ⚠️ 用 `Record<keyof Dict, string>` 而不是 `Dict` ——
 *    效果一样（都是"每个 key 都要有、且是 string"），
 *    但写成 Record 形式更明确地表达意图：
 *    「把 Dict 的每一个 key 映射成一条字符串」。
 */
export type DictMap = Record<keyof Dict, string>;

/**
 * 支持的语言。
 *
 * ⚠️ 加语言时这里要跟着加，且下面的 LANG_LABELS 也要补一条 ——
 *    后者是 `Record<Lang, string>`，漏了会编译报错（有意为之）。
 */
export type Lang = "zh-CN" | "en";

/** 语言在设置界面里的显示名（各自用母语写，这是通行做法） */
export const LANG_LABELS: Record<Lang, string> = {
  "zh-CN": "中文（简体）",
  en: "English",
};

/** 语言下拉里的选项顺序 = 这里数组的顺序 */
export const LANGS: Lang[] = ["zh-CN", "en"];

/**
 * 每本词典在 <html lang> 上要写的值。
 *
 * ⚠️ 这个【不等于】 Lang 本身。
 *    Lang 是我们的内部标识（"zh-CN"），
 *    而这里写的是标准 BCP-47 标签，给搜索引擎和读屏软件看。
 *    现在两者恰好一样，但哪天加了 "zh-TW" 之类的，
 *    这个映射就有了意义 —— 留着它，免得以后满仓库找地方改。
 */
export const HTML_LANG: Record<Lang, string> = {
  "zh-CN": "zh-CN",
  en: "en",
};

/**
 * 一周七天的词典 key，顺序对应 Date.getDay()（0 = 星期日）。
 *
 * ⚠️ 单独导出，而不是让每个组件各写一份数组 ——
 *    日期磁贴（LiveTile）和时钟（useClock）都要用到星期，
 *    两份硬编码数组迟早会漂移（一边改了顺序另一边没改，
 *    表现出来就是"日期磁贴的星期和时钟差一天"）。
 */
export const WEEKDAY_KEYS: (keyof Dict)[] = [
  "time.sunday",
  "time.monday",
  "time.tuesday",
  "time.wednesday",
  "time.thursday",
  "time.friday",
  "time.saturday",
];
