import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { useWindowStore } from "../../store/windowStore";
import type { TagInfo } from "../window/views/TagsView";
import { buildTileGroups, isExternal, isImageIcon, type LaidOutTile } from "../../lib/tiles";
import {
  RECENTLY_ADDED,
  ALL_APPS,
  buildAlphaGroups,
  type MenuItem,
} from "../../config/startMenu";
import TileGrid from "./TileGrid";
import { useT } from "../../i18n";
import { findApp } from "../../config/apps";
import type { Dict } from "../../i18n/types";

/**
 * Win10 开始菜单。
 * ================================================================
 *
 * 结构对应你截图里的样子：
 *
 *   ┌────────────────┬──────────────────────────────┐
 *   │ ☰ Recently added│  Create                      │
 *   │   📄 记事本     │  ┌────┬────┐┌──────────────┐ │
 *   │   💻 此电脑     │  │ 21 │ 最新││    日历      │ │
 *   │ ────────────── │  └────┴────┘└──────────────┘ │
 *   │ Expand ⌄       │  Play                        │
 *   │ A              │  ┌────┬────┐┌──────────────┐ │
 *   │   🧮 归档       │  ...                         │
 *   └────────────────┴──────────────────────────────┘
 *       260px 宽              剩余宽度
 *
 * ⚠️ 三条硬约束（改动前必须知道）：
 *
 *   1. data-startmenu 属性不能删。
 *      任务栏靠它判断「点击是不是在菜单内部」，删了会导致
 *      点磁贴时菜单先被关掉，磁贴随之卸载，click 永远到不了 ——
 *      表现为「点了没反应」。
 *
 *   2. 整个菜单要能被 Esc 关闭、被点击外部关闭。
 *      这两件事由 Taskbar.tsx 统一处理（它是菜单的父级），
 *      这个组件不需要自己监听。别重复加，会触发两次 setState。
 *
 *   3. 磁贴的点击分流（站内开窗口 / 外链新标签页）在 activateTile 里。
 *      加了新入口（比如拖动排序）时别忘了走这条路，否则跳转会不一致。
 */

/* ────────────────────────────────────────────────────────────
   滑入动画
   ──────────────────────────────────────────────────────────── */

/**
 * 开始菜单的进出场动画参数。
 *
 * ⚠️ 这里是 Framer Motion（motion/react）的 variants 写法，
 *    不是 CSS 动画 —— 和之前那个 .anim-menu 类不共存，
 *    两者选一个用（现在是这个）。
 *
 * ── 为什么用 Framer Motion 而不是纯 CSS？ ──
 *
 *    纯 CSS 做「入场」很容易，做「退场」却几乎做不了：
 *    CSS 没法在元素被移除后再播一段动画（元素已经不在 DOM 里了）。
 *
 *    要做出场就得：
 *      1. 标记元素为"正在退场"
 *      2. 加一个退场类
 *      3. 监听 animationend 事件
 *      4. 事件到了才真正卸载
 *    这三步都要手写，而且很容易和 React 的渲染时序打架。
 *
 *    Framer Motion 的 AnimatePresence 就是为这件事造的：
 *    你把组件包起来，它在卸载时会自动延迟到退场动画播完。
 *    见 Taskbar.tsx 里的 <AnimatePresence>。
 *
 * ── 数值为什么是这些？ ──
 *
 *    y: 32  —— 从下方 32px 处滑上来。太大会显得"飞"，太小看不出位移。
 *    scale: 0.95 → 1  —— 轻微的"展开"感。不要再小，否则像在缩放图片。
 *    duration 0.22 / 0.16 —— 入场比退场慢一点：
 *        入场要看清内容（0.22s），退场要"干脆地消失"（0.16s）。
 *        反过来会显得菜单很黏。
 */
const menuVariants = {
  hidden: { opacity: 0, y: 32, scale: 0.95 },
  visible: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 20, scale: 0.97 },
};

const menuTransition = {
  // ⚠️ ease 用 Win10 的那条曲线（起步快、收尾缓）
  //    定义在 global.css 的 --ease-win 里，这里写成等价的三次贝塞尔。
  ease: [0.1, 0.9, 0.2, 1] as const,
  duration: 0.22,
};

/* ────────────────────────────────────────────────────────────
   左侧列表的一个条目
   ──────────────────────────────────────────────────────────── */

function NavRow({ item, onClick }: { item: MenuItem; onClick: (item: MenuItem) => void }) {
  const { t } = useT();

  return (
    <button
      type="button"
      onClick={() => onClick(item)}
      /**
       * 悬停用背景色过渡，不是位移。
       *
       * ⚠️ 这是有意和磁贴区做区分：
       *    右边磁贴 hover 是「浮起来」（位移 + 阴影），
       *    左边列表 hover 是「点亮」（背景变亮）。
       *    如果两边都用同一套反馈，整个菜单会显得没有层次。
       */
      className="flex w-full items-center gap-3 px-4 py-[7px] text-left text-[12px]
                 transition-colors duration-150
                 hover:bg-[var(--hover-invert)]
                 focus:outline-none focus-visible:bg-[var(--hover-invert)]
                 active:bg-[var(--hover-invert-strong)]"
    >
      <NavIcon icon={item.icon} />
      <span className="truncate">{t(item.nameKey as keyof Dict)}</span>
    </button>
  );
}

/** 图标渲染：图片走 img，其它当 emoji */
function NavIcon({ icon }: { icon: string }) {
  if (isImageIcon(icon)) {
    return <img src={icon} alt="" className="h-4 w-4 shrink-0 object-contain" draggable={false} />;
  }
  return <span className="w-4 shrink-0 text-center text-[15px] leading-none">{icon}</span>;
}

/* ────────────────────────────────────────────────────────────
   主组件
   ──────────────────────────────────────────────────────────── */

export interface StartMenuProps {
  /** 真实分类，由 Astro 在构建期算好传进来 */
  categories: TagInfo[];
  /** 真实标签 */
  tags: TagInfo[];
}

export default function StartMenu({ categories, tags }: StartMenuProps) {
  const { t } = useT();
  const open = useWindowStore((s) => s.open);
  const setStartMenu = useWindowStore((s) => s.setStartMenu);

  /** 「Expand」是否展开（收起时只显示首字母，不显示条目） */
  const [expanded, setExpanded] = useState(true);

  /**
   * 点左侧条目。
   *
   * 和磁贴一样要分流：站内开窗口，外部链接走浏览器跳转。
   * 抽成函数是为了让 RECENTLY_ADDED 和 ALL_APPS 共用同一套逻辑 ——
   * 否则以后加一个入口就要复制一遍这段，迟早改漏一处。
   */
  const goto = (item: MenuItem) => {
    if (isExternal(item.url)) {
      window.open(item.url, "_blank", "noopener,noreferrer");
      setStartMenu(false);
      return;
    }

    const app = findApp(item.id);

    /**
     * ⚠️ pageOnly 的应用打开【静态页】，不开窗口。
     *
     *    必须和桌面图标的行为保持一致（见 DesktopIcons 的 launch）。
     *    不统一的话，同一项从桌面点开是网页、从开始菜单点开是窗口，
     *    用户会以为其中一个坏了。
     */
    if (app?.pageOnly) {
      window.open(item.url, "_blank", "noopener,noreferrer");
      setStartMenu(false);
      return;
    }

    open({ id: item.id, title: t(item.nameKey as keyof Dict), icon: item.icon, path: item.url });

    /**
     * ⚠️ 未实现的应用【不同步地址栏】。
     *
     *    它的 path（比如 /search）还没有对应的静态页 ——
     *    replaceState 过去之后，用户一刷新就是 404。
     *    地址栏停在原地反而是诚实的：这个窗口本来就没有地址。
     */
    if (app?.ready !== false && window.location.pathname !== item.url) {
      window.history.replaceState({ path: item.url }, "", item.url);
    }
    setStartMenu(false);
  };

  /**
   * 磁贴文字的取值函数。
   *
   * ⚠️ 和 Tile.tsx 里是同一个逻辑，说明见 config/tiles.ts：
   *    labelKey（内置磁贴）        → 翻译，跟着语言变
   *    label（自动追加的分类/标签）→ 原样，是文章内容
   */
  const tileText = (tile: LaidOutTile) =>
    tile.labelKey ? t(tile.labelKey as keyof Dict) : (tile.label ?? "");

  /** 点磁贴：站内开窗口，外链新标签页 */
  const activateTile = (tile: LaidOutTile) => {
    if (isExternal(tile.path)) {
      // noopener 是必须的：防止新页面通过 window.opener 操作本站
      window.open(tile.path, "_blank", "noopener,noreferrer");
      setStartMenu(false);
      return;
    }

    open({
      id: tile.id,
      title: tileText(tile),
      icon: tile.icon,
      path: tile.path,
      // 宽/大磁贴对应大一点的窗口，视觉上有关联
      ...(tile.pos.colSpan * tile.pos.rowSpan >= 2 ? { w: 860, h: 560 } : {}),
    });

    // ⚠️ 同上：未实现的应用不同步地址栏（它的 path 还没有对应页面）
    const tileApp = findApp(tile.id);
    if (tileApp?.ready !== false && window.location.pathname !== tile.path) {
      window.history.replaceState({ path: tile.path }, "", tile.path);
    }
    setStartMenu(false);
  };

  /**
   * 合成磁贴分组。
   *
   * ⚠️ 用 useMemo 是因为 buildTileGroups 里有 first-fit 排布循环，
   *    每次渲染都重算一遍是浪费 —— 而且它还会 console.warn，
   *    重算会把这些警告刷很多遍。
   */
  const tileGroups = useMemo(
    () => buildTileGroups({ categories, tags }),
    [categories, tags],
  );

  /**
   * 字母索引分组。
   *
   * ⚠️⚠️ 必须把 t() 传进去 —— 分组是按「显示名」的首字母算的，
   *    而配置里存的是 nameKey（"app.notepad"），每一条都以 "app." 开头。
   *    不传的话十一条应用会全部挤进 "A" 区。详见 config/startMenu.ts。
   *
   * ⚠️ 这里【故意不用 useMemo】：
   *    结果依赖当前语言，语言一变就该重算；而 useT() 每次渲染返回新的
   *    t 函数，拿它当依赖会让 useMemo 每次失效（等于没做记忆化）。
   *    何况它只处理十几个条目，重算的开销可以忽略。
   */
  const alphaGroups = buildAlphaGroups(ALL_APPS, (item) => t(item.nameKey as keyof Dict));

  const tileCount = tileGroups.reduce((n, g) => n + g.tiles.length, 0);

  return (
    <motion.div
      /**
       * ⚠️ data-startmenu 是给 Taskbar 的「点击外部关闭」判断用的。
       *    开始菜单和任务栏是兄弟节点，不在任务栏的 DOM 里。
       *    Taskbar 在 capture 阶段监听 mousedown 来关闭菜单，
       *    如果没有这个标记，点磁贴会被误判成「点到了外面」，
       *    菜单在 mousedown 时就被关掉，磁贴随之卸载，
       *    后面的 click 事件永远到不了磁贴 —— 表现就是「点了没反应」。
       *
       *    别删这个属性。
       */
      data-startmenu
      variants={menuVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={menuTransition}
      /**
       * ⚠️ transformOrigin 必须在左下角。
       *
       *    因为开始菜单是从任务栏左下角的开始按钮那个位置"长"出来的，
       *    以左下角为原点缩放/位移，视觉上才有"从按钮弹出"的连贯感。
       *    默认的 center 原点会让它像是凭空浮现在屏幕中间。
       */
      style={{ transformOrigin: "bottom left" }}
      /**
       * 尺寸：宽 640px，高自适应但最高 600px。
       *
       * ⚠️ max-h 用的是 calc(100vh - 任务栏高度 - 一点余量)，
       *    不是写死的 600px。原因：在小屏笔记本上（比如 1366×768），
       *    任务栏 40px + 菜单 600px = 640px，剩下连窗口标题栏都放不下；
       *    而且菜单一旦超过视口高度，底部内容会被切掉且看不见 —— 
       *    用户根本不知道下面还有东西。
       */
      className="start-menu fixed bottom-[var(--taskbar-h)] left-0 z-[110]
                 flex h-[600px] max-h-[calc(100vh-var(--taskbar-h)-16px)] w-[640px] max-w-[100vw]
                 overflow-hidden rounded-tr-[6px]
                 border border-[var(--acrylic-border)] text-[var(--fg-on-acrylic)]
                 shadow-[var(--acrylic-shadow)]
                 acrylic"
    >
      {/* ══ 左栏：导航（固定 260px）══ */}
      <div
        className="start-menu-nav flex w-[260px] shrink-0 flex-col
                   border-r border-[var(--acrylic-border)]
                   bg-[var(--menu-nav-bg)]"
      >
        {/* 滚动区：条目多的时候能滚，但两个区域是一起滚的 */}
        <div className="startmenu-scroll min-h-0 flex-1 overflow-y-auto py-2">
          {/* ── 最近添加 ── */}
          <div className="px-4 pb-1 pt-1 text-[11px] opacity-55">{t("menu.recentlyAdded")}</div>
          {RECENTLY_ADDED.map((item) => (
            <NavRow key={item.id} item={item} onClick={goto} />
          ))}

          {/* 分割线 */}
          <div className="my-2 h-px bg-[var(--acrylic-border)]" />

          {/* ── Expand 开关 ── */}
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="flex w-full items-center gap-2 px-4 py-[7px] text-left text-[11px] opacity-70
                       transition-colors duration-150 hover:bg-[var(--hover-invert)]
                       focus:outline-none focus-visible:bg-[var(--hover-invert)]"
          >
            <span className="truncate">{expanded ? t("menu.collapse") : t("menu.expand")}</span>
            {/*
              箭头旋转 180° 表示展开/收起。
              用 CSS 的 rotate 而不是换一个字符（▲/▼）——
              换字符会让文字基线跳动，rotate 不会。
            */}
            <span
              className="inline-block leading-none transition-transform duration-200"
              style={{ transform: expanded ? "rotate(0deg)" : "rotate(180deg)" }}
            >
              ⌄
            </span>
          </button>

          {/* ── 字母索引 ── */}
          {alphaGroups.map((group) => (
            <div key={group.letter}>
              <div className="px-4 pb-0.5 pt-2 text-[11px] font-medium opacity-55">
                {group.letter}
              </div>

              {/*
                ⚠️ 收起时只显示字母标题，不渲染条目。
                   这是 Win10 Expand 按钮的真实行为 ——
                   它折叠的是"所有应用"这一大块，不是整个菜单。
              */}
              {expanded &&
                group.items.map((item) => (
                  <NavRow key={item.id} item={item} onClick={goto} />
                ))}
            </div>
          ))}
        </div>
      </div>

      {/* ══ 右栏：磁贴（占剩余宽度）══ */}
      <div className="start-menu-tiles min-w-0 flex-1 overflow-y-auto p-5">
        <TileGrid groups={tileGroups} onActivate={activateTile} />

        {/*
          ⚠️ 底部提示只在磁贴特别多的时候才有意义。
             它是给"配置改坏了"这种情况留的线索 ——
             比如磁贴排不下被跳过时，用户能看到总数对不对得上。
        */}
        <p className="mt-3 text-[10.5px] leading-relaxed opacity-40">
          {t("menu.tileCount", { n: tileCount })}
          {" · "}
          {t("menu.tileCountHint")}
        </p>
      </div>
    </motion.div>
  );
}
