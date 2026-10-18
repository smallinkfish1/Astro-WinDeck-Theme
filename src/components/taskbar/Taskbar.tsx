import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { AnimatePresence } from "motion/react";
import { useWindowStore } from "../../store/windowStore";
import { useClock } from "../../hooks/useClock";
import { useIsMobile } from "../../hooks/useIsMobile";
import StartMenu, { type StartMenuProps } from "./StartMenu";
import { isImageIcon } from "../../lib/tiles";
import { useT } from "../../i18n";
import { WEEKDAY_KEYS } from "../../i18n/types";

/**
 * 日历面板 —— 懒加载。
 *
 * ⚠️⚠️ 这一行是整个功能里最省钱的一行，别改成静态 import。
 *
 *    CalendarPanel 依赖 lunar-typescript，那个库：
 *      · 未压缩 415 KB
 *      · gzip 后 105 KB
 *
 *    对一个纯静态博客的首页来说，首屏多背 105 KB 是不可接受的 ——
 *    大部分人只是来看文章的，不需要农历。
 *
 *    用 lazy() 之后，Vite 会把它单独切一个 chunk，
 *    用户【第一次点时间区域】时才下载。
 *    不点，就永远不下载。
 */
const CalendarPanel = lazy(() => import("./CalendarPanel"));

/**
 * 懒加载期间的占位。
 *
 * ⚠️ 高度要尽量接近真实面板（约 340px），
 *    否则下载完成的瞬间面板会"长高"，把任务栏顶一下。
 *    骨架本身用脉冲动画，让用户知道在加载，不是卡死了。
 */
function CalendarSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="absolute bottom-full right-2 mb-2 h-[340px] w-[min(330px,calc(100vw-16px))]
                 animate-pulse rounded-[6px] border border-[var(--surface-border)]
                 bg-[var(--surface)] shadow-[0_8px_28px_rgba(0,0,0,.28)]"
    />
  );
}

/**
 * 任务栏上的窗口图标：emoji 或图片路径二选一。
 * 判断规则和桌面图标、窗口标题栏共用 isImageIcon，三处必须一致。
 */
function TaskbarIcon({ icon }: { icon: string }) {
  if (isImageIcon(icon)) {
    return <img src={icon} alt="" draggable={false} className="h-4 w-4 shrink-0 object-contain" />;
  }
  return <span className="text-[15px] leading-none">{icon}</span>;
}


/** Win10 开始按钮的四方格标志 */
function StartLogo() {
  return (
    <svg viewBox="0 0 20 20" className="h-[18px] w-[18px] fill-current">
      <rect x="0" y="0" width="9" height="9" />
      <rect x="11" y="0" width="9" height="9" />
      <rect x="0" y="11" width="9" height="9" />
      <rect x="11" y="11" width="9" height="9" />
    </svg>
  );
}

/** 回到桌面：两条竖线加一块斜边，Win10 的经典图标 */
function ShowDesktopIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-[15px] w-[15px] fill-none stroke-current stroke-[1.2]">
      <path d="M1 3h11v8H1z" />
      <path d="M13.5 5.5v8h-11" strokeLinecap="square" />
    </svg>
  );
}

/**
 * 任务栏。
 *
 * categories / tags 由 Astro 在构建期算好传进来，再转交给开始菜单。
 * 任务栏本身用不到它们，但它是开始菜单的父组件，所以只是「路过」。
 * 这就是 props 钻透（prop drilling）—— 两层还能接受，再多就该上 Context 了。
 */
export default function Taskbar({ categories, tags }: StartMenuProps) {
  const { t } = useT();
  const windows = useWindowStore((s) => s.windows);
  const topZ = useWindowStore((s) => s.topZ);
  const startMenuOpen = useWindowStore((s) => s.startMenuOpen);
  const toggleStartMenu = useWindowStore((s) => s.toggleStartMenu);
  const setStartMenu = useWindowStore((s) => s.setStartMenu);
  const toggleFromTaskbar = useWindowStore((s) => s.toggleFromTaskbar);
  const minimizeAll = useWindowStore((s) => s.minimizeAll);

  const clock = useClock();
  const isMobile = useIsMobile();
  const barRef = useRef<HTMLDivElement>(null);

  /**
   * 日历面板开着吗。
   *
   * ⚠️ 用本地 state 而不是塞进 windowStore：
   *    整个桌面只有这一个地方读写它，没有跨岛屿共享的需求。
   *    进全局 store 反而会让"关闭时重置翻月状态"变麻烦 ——
   *    现在组件卸载，面板内部的月份自然回到当月。
   */
  const [calOpen, setCalOpen] = useState(false);

  /** 点任务栏空白处 / 点桌面其它地方，都要收起开始菜单 */
  /**
   * 点任务栏空白处 / 点桌面其它地方，都要收起开始菜单。
   *
   * ⚠️ 这里有一个必须处理对的细节（本项目踩过）：开始菜单【不在】barRef 里面。
   *
   *    开始菜单和任务栏是兄弟节点，它贴着任务栏上沿往上展开：
   *        <>{startMenuOpen && <StartMenu />}
   *          <div ref={barRef}>...任务栏...</div></>
   *
   *    所以「点在 barRef 里就不关」这个判断，对开始菜单自己是【不成立】的 ——
   *    点磁贴会被当成点到了外面。
   *
   *    更麻烦的是下面用的是 capture 阶段（第三参 true）。
   *    capture 比冒泡先跑，所以流程会变成：
   *        mousedown(capture) → 关掉开始菜单 → 磁贴被卸载
   *        → mouseup / click 永远到不了磁贴 → 点了没反应
   *
   *    解法是再加一个判断：事件目标如果在开始菜单内部，也不关。
   *    用 closest 往上找，能覆盖磁贴、磁贴里的 span/img、
   *    以及未来拖动排序时加的任何子节点。
   */
  useEffect(() => {
    if (!startMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      /**
       * ⚠️ 这里叫 el 而不是 t ——
       *    因为组件作用域里已经有一个 t（翻译函数）。
       *    叫 t 的话这个局部变量会把翻译函数遮蔽掉，
       *    在那个 useEffect 里就再也调不到 t("...")。
       */
      const el = e.target as HTMLElement | null;
      if (!el) return;

      // 点在任务栏内部（含开始按钮）
      if (barRef.current?.contains(el)) return;

      // 点在开始菜单内部（含磁贴、磁贴里的图标/文字）
      if (el.closest("[data-startmenu]")) return;

      setStartMenu(false);
    };
    // 用 capture，保证在窗口的 onMouseDown 之前先跑
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [startMenuOpen, setStartMenu]);

  /** Esc 关闭开始菜单 */
  useEffect(() => {
    if (!startMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setStartMenu(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [startMenuOpen, setStartMenu]);

  /**
   * 开始菜单和日历面板互斥。
   *
   * ⚠️ 为什么会撞：两个都是从任务栏上沿往上弹，位置几乎重叠。
   *    同时开着会叠成一团，而且点哪个都不对。
   *
   * ⚠️ 这里只处理"开菜单 → 关日历"这一个方向。
   *    反方向（开日历 → 关菜单）在下面时间按钮的 onClick 里做，
   *    因为那里是用户动作发生的现场，顺手关掉最直接。
   */
  useEffect(() => {
    if (startMenuOpen) setCalOpen(false);
  }, [startMenuOpen]);

  return (
    <>
      {/*
        开始菜单贴着任务栏上沿展开。

        ⚠️⚠️ 必须用 <AnimatePresence> 包起来，不能直接
              {startMenuOpen && <StartMenu />}。

        原因：Framer Motion 的「退场动画」需要在组件卸载【期间】
        仍然把它留在 DOM 里播动画。而 {cond && <X/>} 是
        「false 就立刻卸载」，元素当场消失，退场动画根本没机会跑 ——
        结果是菜单"啪"一下不见，只有入场是动画的，很不协调。

        AnimatePresence 做的事就是：拦住这次卸载，等内部的
        motion 元素把 exit 动画播完，再真正移除。所以 StartMenu
        根元素必须是 <motion.div> 并且写了 variants/exit。

        ⚠️ mode="wait" 是必须的。
        不写的话，快速连点开始按钮会出现「上一个还在退场、
        下一个已经在入场」的重叠状态，两个菜单叠在一起。

        ⚠️ AnimatePresence 的子元素【必须】有稳定的 key。
        这里因为只有一个菜单，用固定字符串即可。
        如果以后要支持多个弹层轮流出现，key 必须各不相同，
        否则 AnimatePresence 分不清谁是谁。
      */}
      <AnimatePresence mode="wait">
        {startMenuOpen && <StartMenu key="start-menu" categories={categories} tags={tags} />}
      </AnimatePresence>

      <div
        ref={barRef}
        /**
         * 任务栏材质。
         *
         * .acrylic 负责「半透明底色 + 背景模糊 + 饱和度增强」三件套，
         * 具体色值都在 global.css 的 --acrylic-* 变量里，暗色模式自动切换。
         *
         * ⚠️ 这里用 CSS 类而不是内联 style，是因为 .acrylic 还带了
         *    .no-acrylic 降级规则和暗色模式的 brightness 补偿，
         *    写内联样式会把这些都盖掉。
         */
        className="acrylic fixed inset-x-0 bottom-0 z-[100] flex items-center
                   border-t border-[var(--acrylic-border)] text-[var(--fg-on-acrylic)]"
        style={{ height: "var(--taskbar-h)" }}
      >
        {/* ── 左：开始按钮 ── */}
        <button
          aria-label={t("taskbar.start")}
          aria-expanded={startMenuOpen}
          onClick={toggleStartMenu}
          className={`grid h-full w-12 shrink-0 place-items-center transition-colors
                      ${startMenuOpen ? "bg-[var(--hover-invert)]" : "hover:bg-[var(--hover-invert)]"}`}
        >
          <StartLogo />
        </button>

        {/* ── 中：已打开窗口 ── */}
        <div className="taskbar-scroll taskbar-window-list flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-1">
          {windows.map((w) => {
            // ⚠️ topZ 必须从 store 订阅（上面 useWindowStore((s) => s.topZ)），
            // 不能用 useWindowStore.getState() 在渲染里读 —— 那样拿不到最新值，
            // 高亮状态永远不会更新。
            const active = !w.minimized && w.z === topZ;
            return (
              <button
                key={w.id}
                aria-label={w.title}
                title={w.title}
                onClick={() => toggleFromTaskbar(w.id)}
                className={`relative flex h-9 shrink-0 items-center gap-2 rounded px-2.5 text-[12px]
                            transition-colors
                            ${active ? "bg-[var(--hover-invert)]" : "hover:bg-[var(--hover-invert)]"}
                            ${w.minimized ? "opacity-60" : ""}`}
              >
                <TaskbarIcon icon={w.icon} />
                {/* 移动端空间紧张，只留图标 */}
                {!isMobile && <span className="max-w-[130px] truncate">{w.title}</span>}
                {/* Win10 的运行指示条：可见时是实心，最小化时是空心 */}
                <span
                  className={`absolute inset-x-2 -bottom-[1px] h-[2px] rounded-full transition-colors
                              ${w.minimized ? "bg-current opacity-25" : "bg-current opacity-70"}`}
                />
              </button>
            );
          })}
        </div>

        {/* ── 右：系统托盘 ── */}
        <div className="flex h-full shrink-0 items-center">
          {/*
            实时时钟：时间 + 日期。

            ⚠️ 以前是个 div（纯展示），现在必须是 button ——
               点它要弹日历。用 button 而不是 div + onClick：
               键盘能 Tab 到、能用回车触发、屏幕阅读器知道它能点。

            ⚠️ data-calendar-toggle 是给 CalendarPanel 认的。
               面板监听"点外部关闭"时，要放过这个按钮 ——
               否则点击事件会先关面板、再被按钮的 onClick 重新打开，
               结果就是"点了没反应"。
          */}
          <button
            type="button"
            data-calendar-toggle
            aria-label={t("taskbar.openCalendar")}
            aria-expanded={calOpen}
            title={`${clock.date} ${t(WEEKDAY_KEYS[clock.weekdayIndex])}`}
            onClick={() => {
              setCalOpen((v) => !v);
              // 开日历就收起开始菜单 —— 两个面板位置重叠，不能同时开
              setStartMenu(false);
            }}
            className={`flex h-full flex-col items-center justify-center px-3
                        text-[11px] leading-tight transition-colors
                        ${calOpen ? "bg-[var(--hover-invert)]" : "hover:bg-[var(--hover-invert)]"}`}
          >
            <span className="tabular-nums">{clock.time}</span>
            {!isMobile && <span className="opacity-80">{clock.date}</span>}
          </button>

          {/* 回到桌面 */}
          <button
            aria-label={t("taskbar.showDesktop")}
            title={t("taskbar.showDesktop")}
            onClick={minimizeAll}
            className="grid h-full w-10 place-items-center border-l border-[var(--acrylic-border)]
                       transition-colors hover:bg-[var(--hover-invert)]"
          >
            <ShowDesktopIcon />
          </button>
        </div>

        {/*
          日历面板。

          ⚠️ 放在任务栏这个 fixed 容器【内部】，而不是外面 ——
             它靠 `absolute bottom-full` 贴在任务栏上沿。
             fixed 元素是定位包含块，所以这里的绝对定位是相对任务栏算的。

          ⚠️ Suspense 包在外层、条件判断在里层：
             这样 calOpen 为 false 时子元素是 false，不会触发挂起，
             也就不会出现"没开面板却显示了骨架"。

          ⚠️ 退出动画这里没有做（AnimatePresence 那套）。
             日历面板是瞬时开关的，加动画反而拖沓；
             开始菜单有退场动画是因为它面积大、突然消失很突兀。
        */}
        <Suspense fallback={<CalendarSkeleton />}>
          {calOpen && <CalendarPanel onClose={() => setCalOpen(false)} />}
        </Suspense>
      </div>
    </>
  );
}
