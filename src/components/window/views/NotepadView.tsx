import { useState, useMemo, useRef, useEffect } from "react";
import { readingMinutes, renderMarkdown, type ClientPost } from "../../../lib/markdown";
import { useT, fmtDate } from "../../../i18n";

/**
 * 「记事本」窗口 —— 仿 Win10 Notepad 读文章。
 *
 * 和「此电脑」「浏览器」的分工：
 *   此电脑   → 用文件的方式*找*文章（列表、排序、分类）
 *   记事本   → 用纯文本的方式*读*文章
 *   浏览器   → 站在站外的视角（友情链接、社交主页）
 *
 * ── 两种视图模式 ──
 *
 *   渲染视图（默认）：正文按 Markdown 渲染，公式、表格、代码块都正常显示
 *   源码视图：      显示 .md 原文，等宽字体，带行号状态栏
 *
 * ⚠️ 为什么默认给渲染视图？
 *    因为绝大多数人打开一篇文章是想【读】它，不是想看源码。
 *    源码模式是给作者用的，属于"需要时才切过去"的场景 ——
 *    把它设成默认，等于让所有人先看到一堆标记符号。
 *
 * ⚠️ 为什么不像别的博客那样只留渲染模式？
 *    因为"看到 Markdown 原文"本身有价值：
 *      - 想学这个站怎么写的，可以直接抄语法
 *      - 公式写错时，看原文比看渲染结果更容易定位
 *    这是 Win10 记事本该有的样子：朴素、直给、不做花活。
 *
 * 还原的细节：
 *   - 顶部菜单栏：文件 / 编辑 / 格式 / 查看 / 帮助
 *   - 「格式」菜单里可以勾选"自动换行"（真的能用，不是装饰）
 *   - 源码视图下等宽字体、无行号，就是 Win10 记事本的样子
 *   - 左下角状态栏显示 行/列，会跟着光标动
 */

/**
 * 视图模式存在哪。
 *
 * ⚠️ 为什么要持久化？
 *    因为记事本的两种视图是【使用习惯】而不是"临时看一眼"。
 *    喜欢读源码的人每次打开都要按一次 F9，很烦；
 *    而喜欢渲染视图的人万一上次误切到源码，下次打开会一脸茫然
 *    （"我的公式怎么不渲染了？"）。
 *    存下来，让用户的最后选择成为下次的默认。
 *
 * ⚠️ 键名和别的设置一样加前缀。注意它【不进 THEME_BOOTSTRAP】——
 *    它不影响首屏绘制（正文是异步渲染的），晚一步读到完全没问题，
 *    没必要为它增加启动脚本的复杂度。
 */
const KEY_NOTEPAD_VIEW = "win10-blog:notepad-view";
/** 居中阅读开关。和视图模式分开存，两者互不影响 */
const KEY_NOTEPAD_CENTER = "win10-blog:notepad-center";

/** 读上次的视图模式。默认渲染视图（true） */
function getSavedRendered(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(KEY_NOTEPAD_VIEW) !== "source";
}

/**
 * 读上次的「居中阅读」。
 *
 * ⚠️ 默认【开】。
 *
 *    判断的是 `!== "off"` 而不是 `=== "on"`：
 *    没存过（第一次用）、值被改坏、读不出来 —— 都按"开"处理。
 *    理由是窗口可以拉得很宽，不居中的话一行能排一百多个字，
 *    长文基本没法读。默认开是在替用户做正确的选择。
 */
function getSavedCentered(): boolean {
  if (typeof localStorage === "undefined") return true;
  return localStorage.getItem(KEY_NOTEPAD_CENTER) !== "off";
}

/**
 * 从所有文章里随机挑一篇。
 *
 * ⚠️ 需求是「每次打开时随机挑一篇」。这里的"每次打开"指的是
 *    【组件挂载】这一次 —— 不是每次渲染。
 *    所以只能用在 useState 的惰性初始化里，绝不能写成
 *    useState(pickRandom(posts)) 那种在渲染中直接调用随机函数的形式：
 *    那样每次父组件重渲染都会重新摇一次，文章会自己乱跳。
 *
 * ⚠️ 空数组要兜底。posts 为空时返回 ""，
 *    下面的渲染分支会显示"记事本里还没有内容"，
 *    而不是抛一个 undefined.slug 的错把整个窗口炸掉。
 */
function pickRandomSlug(posts: ClientPost[]): string {
  if (!posts.length) return "";
  const i = Math.floor(Math.random() * posts.length);
  return posts[i].slug;
}


/**
 * 把文章的元信息重新拼成一段 YAML frontmatter。
 *
 * ⚠️ 这里有个容易想错的地方：
 *    「直接把 .md 文件的原始文本读出来显示」是做不到的。
 *    Astro 的 content collection 在构建期就把 frontmatter 解析掉了，
 *    entry.body 里【只剩正文】，--- 那一段已经不存在了。
 *    （想拿到原始文本得用 import.meta.glob 的 ?raw，那会额外打包
 *      一份完整的 .md 进产物，代价太大。）
 *
 *    所以这里换个思路：用已经解析好的结构化字段【反向拼回】YAML。
 *    好处是拿到的就是文章的真实元信息，对任何一篇文章都成立，
 *    而且不用多打一份包。
 */
function buildFrontmatter(a: ClientPost): string {
  const tags = a.tags.length ? `[${a.tags.map((t) => `"${t}"`).join(", ")}]` : "[]";
  return [
    "---",
    `title: ${a.title}`,
    `description: ${a.description || ""}`,
    `pubDate: ${a.pubDate.slice(0, 10)}`,
    `category: ${a.category}`,
    `tags: ${tags}`,
    ...(a.accent ? [`accent: "${a.accent}"`] : []),
    "---",
  ].join("\n");
}

export default function NotepadView({
  posts,
  slug: initialSlug,
  onlySource = false,
}: {
  posts: ClientPost[];
  /**
   * 从外面指定"打开哪一篇"。
   *
   * ⚠️ 为什么需要这个 prop？
   *    默认行为是随机挑一篇，但从「此电脑」里双击一篇文章时，
   *    用户的意图非常明确 —— 就是要看那一篇，随机就毫无道理了。
   *    WindowManager 会开一个 id 形如 notepad:<slug> 的窗口，
   *    把 slug 从这里传进来。
   *
   * ⚠️ 不传时（比如双击桌面上的记事本图标）走随机。
   */
  slug?: string;

  /**
   * 「只读源码」模式 —— 回收站双击草稿时用。
   *
   * ⚠️⚠️ 打开它之后，这个窗口【只能看 .md 原文】：
   *
   *   · 强制源码视图，且无法切换（F9 无效、菜单项置灰、状态栏按钮不可点）
   *   · textarea 只读
   *   · 视图模式【不写入 localStorage】
   *
   * ── 为什么视图模式不能写 localStorage？ ──
   *
   *   这是个很容易踩的坑。设想：
   *     用户平时爱看渲染视图（localStorage 存着 "rendered"）
   *     → 从回收站双击一个草稿
   *     → 如果这个窗口也去写 localStorage，就会把用户的选择覆盖成 "source"
   *     → 下次他正常打开一篇文章，发现变成源码了，一脸茫然
   *
   *   ⚠️ 更隐蔽的是反向情况：
   *     如果这里【读】localStorage，那用户在别处选了渲染视图，
   *     回收站里打开草稿就会显示渲染后的 HTML ——
   *     完全违背"看原始字符"的初衷，而且看起来像 bug。
   *
   *   所以这个模式下：既不解锁渲染视图，也不碰持久化。
   *   它的视图状态是【完全本地、完全受控】的。
   *
   * ── 为什么不用一个独立的组件？ ──
   *
   *   因为 90% 的逻辑（菜单栏、字号、自动换行、行列号、切换文章）
   *   和普通记事本完全一样。复制一个组件出来，
   *   以后修任何一个 bug 都得改两遍 —— 而且很容易只改一遍。
   */
  onlySource?: boolean;
}) {
  /**
   * 当前在读的文章。
   *
   * ⚠️⚠️ 惰性初始化，而且必须【只初始化一次】。
   *
   *    写成 useState(pickRandomSlug(posts)) 是错的 ——
   *    pickRandomSlug 会在【每次渲染】时被调用（结果被丢弃但副作用还在），
   *    虽然 useState 只取第一次的值，但每次渲染都摇一次随机数
   *    属于"看起来没 bug、实际上在偷偷干活"，而且很容易在
   *    以后被误改成 setState(...) 时引爆。
   *
   *    写成 useState(() => ...) 才是对的：这个函数只在挂载时执行一次。
   *
   * ⚠️ 外面的 initialSlug 优先于随机。
   */
  const { t, lang, regional } = useT();

  const [slug, setSlug] = useState<string>(() => initialSlug ?? pickRandomSlug(posts));
  const [wrap, setWrap] = useState(true);
  /**
   * 居中阅读：内容限制在 720px 宽、左右自动留白。
   *
   * ⚠️ 只影响【渲染视图】。源码视图不居中 ——
   *    代码需要宽度，一行被折断比没有留白难受得多。
   */
  const [centered, setCentered] = useState(() => getSavedCentered());
  /** 菜单栏展开的是哪一项，null 表示都收起 */
  const [menu, setMenu] = useState<string | null>(null);

  /** 光标位置（行 / 列），状态栏用 */
  const [pos, setPos] = useState({ line: 1, col: 1 });
  /** 字号档位：Win10 记事本「格式 → 字体」给的就是这几档 */
  const [fontIdx, setFontIdx] = useState(1);
  const FONTS = [11, 12, 14, 16, 18];

  /**
   * 视图模式：true = 渲染 Markdown，false = 显示 .md 源码。
   *
   * ⚠️ 初始值从 localStorage 读（上次的选择），默认渲染视图 ——
   *    打开文章的第一诉求是"读"，不是"看语法"。
   *
   * ⚠️⚠️ onlySource 模式下【跳过 localStorage，强制源码视图】。
   *    因为：
   *      1. 从 localStorage 读 → 用户平时选了渲染视图，这里就会渲染 HTML，
   *         完全违背"看原始字符"的初衷
   *      2. 后面那个写回 localStorage 的 effect 也必须一起跳过 ——
   *         否则会把用户的选择覆盖成 "source"，
   *         下次他正常打开文章就莫名变成源码视图了
   *
   *    所以惰性初始化这里直接短路成 false（= 源码视图）。
   */
  const [rendered, setRendered] = useState(() => (onlySource ? false : getSavedRendered()));

  /**
   * 统一切换视图的入口。
   *
   * ⚠️ 为什么不直接在各处调 setRendered？
   *    因为 onlySource 模式要拦截它 —— 拦截点只有一个才安全。
   *    F9、查看菜单、状态栏按钮三个入口如果各自判断一遍
   *    "我现在是不是只读模式"，迟早漏一个。
   */
  const toggleRendered = (next?: boolean) => {
    if (onlySource) return;
    setRendered((v) => next ?? !v);
  };

  /**
   * 外面换了文章时（比如从 /posts/foo 直接进站，然后又在同一个
   * 记事本窗口里被要求看 bar），跟着切过去。
   *
   * ⚠️ 只在 initialSlug 真的变了、且和当前不同时才写。
   *    不加这个判断的话，每次父组件重渲染都会 setSlug，
   *    把用户通过下拉框手选的另一篇给顶回去。
   */
  useEffect(() => {
    if (initialSlug && initialSlug !== slug) setSlug(initialSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSlug]);

  const areaRef = useRef<HTMLTextAreaElement>(null);

  const article = useMemo(
    () => posts.find((p) => p.slug === slug) ?? posts[0],
    [posts, slug]
  );

  /**
   * 记事本里显示的内容：元信息（拼回的 frontmatter）在最上面，
   * 后面接正文 —— 就是一个纯文本 .md 文件该有的样子。
   */
  const text = useMemo(() => {
    if (!article) return "";
    return `${buildFrontmatter(article)}\n\n${article.body}`;
  }, [article]);

  /**
   * 渲染视图下用的 HTML。
   *
   * ⚠️ 只在 rendered 为 true 时才算 —— 源码视图下白算一遍
   *    几百个公式纯属浪费。useMemo 的依赖里带上 rendered，
   *    切到源码时这个值会自然失效。
   */
  const html = useMemo(
    () => (rendered && article ? renderMarkdown(article.body) : ""),
    [rendered, article]
  );

  /**
   * 视图模式变化时写回 localStorage。
   *
   * ⚠️ 写成 effect（而不是在每个 setRendered 调用点手写一次保存），
   *    是因为设置视图模式的入口有三个：F9 快捷键、查看菜单、状态栏按钮。
   *    靠人肉在每个入口都记得存一次，迟早漏一个 ——
   *    而且漏的表现很隐蔽（"用菜单切能记住，按 F9 切就记不住"）。
   *    挂在状态上，所有入口自动一致。
   *
   * ⚠️⚠️ onlySource 模式下【直接跳过】。
   *    因为这个模式下的 rendered 恒为 false，如果不跳过，
   *    每个回收站窗口一打开就会把用户的全局偏好写成 "source" ——
   *    下次他正常打开一篇文章，发现莫名其妙变成源码视图了。
   *
   *    ⚠️ 这是个「就地污染用户设置」的 bug：从回收站点一次草稿，
   *       就永久改掉了另一个窗口的默认行为。而且两者看起来毫无关系，
   *       排查时几乎想不到是这里干的。
   */
  useEffect(() => {
    if (onlySource) return;
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(KEY_NOTEPAD_VIEW, rendered ? "rendered" : "source");
  }, [rendered, onlySource]);

  /**
   * 记住「居中阅读」的选择。
   *
   * ⚠️ 这个和视图模式不同，不需要 onlySource 保护 ——
   *    只读模式下用户仍然是在这个窗口里读文章，
   *    他的偏好应该照常被记住。
   */
  useEffect(() => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(KEY_NOTEPAD_CENTER, centered ? "on" : "off");
  }, [centered]);

  /** 点菜单外部就收起。用 pointerdown 而不是 click，手感更跟手 */
  useEffect(() => {
    if (!menu) return;
    const close = (e: PointerEvent) => {
      if (!(e.target as Element).closest("[data-np-menu]")) setMenu(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menu]);

  /** 跟随光标更新行列号 */
  const onSelect = () => {
    const el = areaRef.current;
    if (!el) return;
    const upto = el.value.slice(0, el.selectionStart);
    const line = upto.split("\n").length;
    const col = upto.length - upto.lastIndexOf("\n");
    setPos({ line, col });
  };

  /** 把光标前的文本读出来，切文章时重置到开头 */
  useEffect(() => {
    setPos({ line: 1, col: 1 });
    if (areaRef.current) areaRef.current.scrollTop = 0;
  }, [slug]);

  /** 上一篇 / 下一篇 —— 「查看」菜单里的"转到" */
  const goto = (delta: number) => {
    const i = posts.findIndex((p) => p.slug === slug);
    const next = posts[(i + delta + posts.length) % posts.length];
    if (next) setSlug(next.slug);
  };

  /**
   * F9 切换视图模式。
   *
   * ⚠️ 为什么是 F9 而不是别的键？
   *    只是随手挑一个好记的、又不会和浏览器快捷键冲突的。
   *    F5 是刷新、F12 是开发者工具、Ctrl+S 是保存网页 —— 都撞。
   *
   * ⚠️ 只在【这个记事本窗口有焦点】时生效。
   *    判断方式是看事件源在不在当前容器的 DOM 里 ——
   *    否则用户在别的窗口里按 F9 也会把记事本切了，很怪。
   *
   * ⚠️⚠️ onlySource 模式下【直接 return】。
   *    光靠"菜单项置灰"是不够的 —— 快捷键是绕过 UI 的后门。
   *    用户按了没反应会以为是坏了，但总比"能绕过只读限制"好。
   *    置灰 + 快捷键无效，两处都堵上。
   */
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "F9") return;
      // 事件源不在本窗口内 → 忽略
      if (!rootRef.current?.contains(e.target as Node)) return;
      e.preventDefault();
      // 只读源码模式：吃掉这次按键，但什么也不做
      if (onlySource) return;
      setRendered((v) => !v);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onlySource]);

  if (!article) {
    return (
      <div className="grid h-full place-items-center bg-white text-[12px] text-[#8a94a3]">
        {t("np.empty")}
      </div>
    );
  }

  /** 菜单定义。每一项要么执行一个动作，要么是纯展示项（disabled） */
  const MENUS: { name: string; items: { label: string; run?: () => void; check?: boolean }[] }[] = [
    {
      name: t("np.file"),
      items: [
        { label: t("np.new"), run: () => window.open("/posts", "_blank", "noopener") },
        {
          label: t("np.openStatic"),
          run: () => window.open(`/posts/${article.slug}`, "_blank", "noopener,noreferrer"),
        },
        { label: "—" },
        { label: t("np.exit"), run: () => window.dispatchEvent(new CustomEvent("os:close-window")) },
      ],
    },
    {
      name: t("np.edit"),
      items: [
        { label: t("np.selectAll"), run: () => areaRef.current?.select() },
        { label: t("np.copy"), run: () => navigator.clipboard?.writeText(text) },
        { label: "—" },
        { label: t("np.find") },
      ],
    },
    {
      name: t("np.format"),
      items: [
        /*
          ⚠️ 「自动换行」只在源码视图下有意义。
             渲染视图是 HTML 排版，换不换行由 CSS 决定，
             这个开关点了也没效果 —— 所以渲染视图下把它禁用掉，
             而不是让它看起来能用但实际没反应。
        */
        {
          label: t("np.wordWrap"),
          check: wrap,
          run: rendered ? undefined : () => setWrap((w) => !w),
        },
        { label: "—" },
        ...FONTS.map((f, i) => ({
          label: t("np.font", { size: f }),
          check: i === fontIdx,
          run: () => setFontIdx(i),
        })),
      ],
    },
    {
      name: t("np.view"),
      items: [
        /*
          ── 视图切换 ──
          Win10 记事本没有这个功能，但这里是"读博客"不是"写 txt"，
          所以加了它。放在最上面是因为它是最常用的那一项。

          ⚠️⚠️ onlySource 模式下这两项【置灰但不隐藏】。
             为什么置灰而不是干脆隐藏：
               隐藏的后果是"用户根本不知道有渲染视图这回事"，
               下次他在别处看到别的窗口能切，会觉得这里坏了。
               灰掉则是"有这么个东西，但当前不能用"——
               这和控制面板里未实现的分类是同一个思路。

             ⚠️ 置灰靠的是给 run 传 undefined（菜单项渲染逻辑里
                `disabled={!it.run}`）。所以这里必须把 run 拿掉，
                光加个 disabled 字段是没用的。
        */
        {
          label: t("np.renderedView"),
          check: rendered,
          run: onlySource ? undefined : () => setRendered(true),
        },
        {
          label: t("np.sourceView"),
          check: !rendered,
          run: onlySource ? undefined : () => setRendered(false),
        },
        { label: "—" },
        /*
          ⚠️ 居中阅读只在渲染视图下可用。
             源码视图居中会把长代码折成好几段，反而更难读，
             所以非渲染视图时把它置灰（run 传 undefined）。
        */
        {
          label: t("np.centerReading"),
          check: centered,
          run: rendered ? () => setCentered((v) => !v) : undefined,
        },
        { label: "—" },
        { label: t("np.prev"), run: () => goto(-1) },
        { label: t("np.next"), run: () => goto(1) },
        { label: "—" },
        /*
          ⚠️ 「随机换一篇」用【排除当前这篇】的随机，而不是直接摇。

             直接摇有个 1/N 的概率摇到自己 —— 用户点了菜单，
             窗口里什么都没变，第一反应是"这个功能坏了"。
             N 越大越不容易撞上，也就越难发现；但文章少的时候
             （比如只有 3 篇）就有 1/3 的概率点了个寂寞。

             排除自己之后，只要还有别的文章，点击必有变化。
        */
        {
          label: t("np.random"),
          run: () => {
            const others = posts.filter((p) => p.slug !== slug);
            if (!others.length) return;
            setSlug(others[Math.floor(Math.random() * others.length)].slug);
          },
        },
      ],
    },
    {
      name: t("np.help"),
      items: [{ label: t("np.aboutNotepad"), run: () => window.open("/about", "_blank", "noopener") }],
    },
  ];

  /**
   * 当前这篇的"文件大小"。
   * 用 Blob 算真实字节数 —— 看着像不像记事本，很大程度靠这行小字。
   */
  const bytes = new Blob([text]).size;

  return (
    <div
      ref={rootRef}
      className="flex h-full flex-col bg-[var(--surface)]"
      onClick={() => setMenu(null)}
    >
      {/* ── 菜单栏 ── */}
      <div className="flex shrink-0 items-center border-b border-[var(--surface-border)] bg-[var(--surface-2)] px-1 text-[12px]">
        {MENUS.map((m) => (
          <div key={m.name} className="relative" data-np-menu>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMenu((cur) => (cur === m.name ? null : m.name));
              }}
              onMouseEnter={() => setMenu((cur) => (cur ? m.name : cur))}
              className={`rounded px-2.5 py-1 transition-colors ${
                menu === m.name ? "bg-[var(--active)]" : "hover:bg-[var(--hover)]"
              }`}
            >
              {m.name}
            </button>

            {menu === m.name && (
              <div
                className="absolute left-0 top-full z-30 min-w-[190px] rounded-sm border
                           border-[var(--surface-border)] bg-[var(--surface)] py-1 shadow-lg"
              >
                {m.items.map((it, i) =>
                  it.label === "—" ? (
                    <div key={i} className="my-1 border-t border-[var(--surface-border)]" />
                  ) : (
                    <button
                      key={i}
                      type="button"
                      disabled={!it.run}
                      onClick={(e) => {
                        e.stopPropagation();
                        it.run?.();
                        setMenu(null);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-1 text-left text-[12px]
                                 transition-colors hover:bg-[var(--accent)] hover:text-white
                                 disabled:cursor-default disabled:text-[var(--fg-faint)]
                                 disabled:hover:bg-transparent disabled:hover:text-[var(--fg-faint)]"
                    >
                      <span className="w-3 shrink-0 text-[10px]">{it.check ? "✓" : ""}</span>
                      <span className="truncate">{it.label}</span>
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        ))}

        {/* 右侧：快速切换文章的下拉 */}
        <select
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="no-drag ml-auto mr-1 max-w-[220px] rounded border border-[var(--surface-border)]
                     bg-[var(--surface)] px-1.5 py-0.5 text-[11px] outline-none"
          aria-label={t("np.switchArticle")}
        >
          {posts.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.title}
            </option>
          ))}
        </select>
      </div>

      {/* ── 正文区域：两种视图二选一 ── */}
      {rendered ? (
        /*
          渲染视图。

          ⚠️ 用 dangerouslySetInnerHTML —— 安全性讨论见 ArticleView.tsx
             顶部那段注释。简单说：输入是仓库里的 .md 文件，完全可控。

          ⚠️ 换用 .md-body 这个类，和静态文章页、ArticleView 共用同一套
             排版规则。三处正文长得一样，改一处全都跟着变。
        */
        <div className="win-body min-h-0 flex-1 overflow-auto bg-[var(--surface)] p-4">
          {/*
            ⚠️ 居中靠 mx-auto + max-w，不需要额外的包裹层。
            ⚠️ 720px 是一行约 75-80 个汉字的宽度。
               窗口比这窄时 max-w 会自动收缩，不会出现横向滚动。
          */}
          <div
            className={`md-body ${centered ? "mx-auto max-w-[720px]" : ""}`}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </div>
      ) : (
        /*
          源码视图：真的用 textarea，才有"记事本"的编辑手感。

          ⚠️ readOnly 是【一直】为 true 的，不是只有 onlySource 才加 ——
             这个窗口的定位是"读文件"，编辑了也存不回去，
             给一个能打字的框是在骗用户。
             回收站那条路径只是额外锁定了视图模式而已。
        */
        <textarea
          ref={areaRef}
          value={text}
          readOnly
          spellCheck={false}
          wrap={wrap ? "soft" : "off"}
          onSelect={onSelect}
          onClick={onSelect}
          onKeyUp={onSelect}
          className="win-body min-h-0 flex-1 resize-none bg-[var(--surface)] p-3 font-mono
                     leading-[1.55] text-[var(--fg)] outline-none"
          style={{
            fontSize: `${FONTS[fontIdx]}px`,
            whiteSpace: wrap ? "pre-wrap" : "pre",
            overflowX: wrap ? "hidden" : "auto",
          }}
          /*
            ⚠️ aria-label 区分两种模式。
               读屏用户听到"草稿原文（只读）"就知道这是个快照，
               而不是一个可以编辑但没反应的表单 ——
               后者会让人以为页面卡住了。
          */
          aria-label={
            onlySource
              ? t("np.readonlyAria", { title: article.title })
              : t("np.markdownAria", { title: article.title })
          }
        />
      )}

      {/* ── 状态栏 ── */}
      <div className="flex shrink-0 items-center gap-4 border-t border-[var(--surface-border)] bg-[var(--surface-2)] px-3 py-1 text-[11px] text-[var(--fg-dim)]">
        <span className="truncate">
          {article.title}
          <span className="ml-2 text-[var(--fg-faint)]">
            {fmtDate(article.pubDate, lang, regional)} ·{" "}
            {t("time.readingTime", { n: readingMinutes(article.body) })}
          </span>
        </span>

        {/*
          ⚠️ 行列号只在源码视图下有意义 ——
             渲染视图里没有"光标"这个概念，一直显示"第 1 行，第 1 列"
             会让人以为是坏了。
        */}
        {!rendered && (
          <span className="ml-auto shrink-0 tabular-nums">
            {t("np.lineCol", { line: pos.line, col: pos.col })}
          </span>
        )}

        <span className={rendered ? "ml-auto shrink-0" : "shrink-0"}>
          {/*
            视图模式给个明确提示，免得用户以为公式渲染不了。

            ⚠️⚠️ onlySource 模式下这个按钮【禁用】。
               它是第三个能切换视图的入口（另两个是 F9 和查看菜单），
               三个入口必须同时堵上 —— 漏一个，只读限制就被绕过去了。

               ⚠️ 这里用 disabled 属性 + 保留原文字，
                  而不是把按钮换成一个静态 span：
                  按钮变灰能传达"本来能点"，静态文字不能。
          */}
          <button
            type="button"
            onClick={() => toggleRendered()}
            disabled={onlySource}
            className="no-drag rounded px-1.5 py-0.5 transition-colors hover:bg-[var(--hover)]
                       hover:text-[var(--accent)] disabled:cursor-default
                       disabled:hover:bg-transparent disabled:hover:text-[var(--fg-dim)]"
            title={onlySource ? t("np.toggleTip") : t("np.toggleTipNormal")}
          >
            {rendered ? t("np.renderedViewShort") : t("np.sourceViewShort")}
          </button>
        </span>

        {/*
          ⚠️ 只读标记。
             用户会好奇"为什么这个框不能打字" —— 与其让他猜，
             不如直接写出来。这也是和普通记事本最大的区别。

             ⚠️ 只在 onlySource 下显示，普通记事本本来就不需要解释。
        */}
        {onlySource && (
          <span
            className="shrink-0 rounded bg-[var(--surface-3)] px-1.5 py-px text-[10px]
                       text-[var(--fg-faint)]"
            title={t("np.readonlyTip")}
          >
            {t("np.readonly")}
          </span>
        )}

        {!rendered && (
          <span className="shrink-0 text-[var(--fg-faint)]">
            {wrap ? t("np.wordWrap") : t("np.wordWrapOff")} · {t("np.bytes", { n: bytes })}
          </span>
        )}
      </div>
    </div>
  );
}
