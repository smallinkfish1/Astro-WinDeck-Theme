import { useEffect, useMemo, useRef, useState } from "react";
import { buildMonth, todaySummary, type CalendarCell } from "../../lib/lunar";
import { localeFor, useT } from "../../i18n";

/**
 * 任务栏日历面板
 * ================================================================
 *
 * 点任务栏右下角的时间弹出来，Win10 中文版那个样子。
 *
 * ── ⚠️ 这个组件是【懒加载】的 ──
 *
 *   它 import 了 lunar-typescript，那个库 gzip 后 105 KB。
 *    对一个纯静态博客的首页来说，这钱不能花在首屏上。
 *
 *   所以 Taskbar.tsx 里用 React.lazy 包着它 ——
 *    用户第一次点时间区域时才下载这个 chunk。
 *    只想看文章的人，永远不会为它付流量。
 *
 * ── 为什么翻月状态放在组件内部，不进 store ──
 *
 *   因为"翻到 11 月 → 关掉面板 → 再打开"应该回到当月，
 *    而不是停在上次翻到的地方。这是日历的常识行为。
 *   放 store 里就得额外写一套"关闭时重置"的逻辑，
 *    放组件里天然就是这样（关闭 = 卸载 = 状态清空）。
 *
 * ── 一周从周几开始 ──
 *
 *   中文习惯周一开头，英文习惯周日开头，所以跟着语言变。
 *   ⚠️ 这个值同时影响表头顺序和 1 号前面补几格，
 *      两处必须用同一个 weekStart，否则日期会整体错位一天。
 */
export default function CalendarPanel({ onClose }: { onClose: () => void }) {
  const { t, lang, regional } = useT();
  const locale = localeFor(lang, regional);

  const panelRef = useRef<HTMLDivElement>(null);

  /** 当前显示的月份。初值是"现在所在的月"，不是写死的某个月 */
  const [view, setView] = useState(() => {
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  });

  /** 0 = 周日开头，1 = 周一开头 */
  const weekStart = lang === "zh-CN" ? 1 : 0;

  const cells = useMemo(
    () => buildMonth(view.year, view.month, weekStart),
    [view.year, view.month, weekStart],
  );

  /** 月份标题：中文「2026年10月」，英文「October 2026」 */
  const title = useMemo(
    () =>
      new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" }).format(
        new Date(view.year, view.month - 1, 1),
      ),
    [locale, view.year, view.month],
  );

  /**
   * 星期表头。
   *
   * ⚠️ 中文用 narrow（日一二三…单字），英文用 short（Sun/Mon…）。
   *    英文的 narrow 是 S M T W T F S —— S 和 T 各出现两次，分不清。
   *    中文的 short 是「周日周一」两个字的，表头会挤。
   */
  const weekdayLabels = useMemo(() => {
    const width: "narrow" | "short" = lang === "zh-CN" ? "narrow" : "short";
    const fmt = new Intl.DateTimeFormat(locale, { weekday: width });
    // 2024-01-07 是周日，拿它当基准，按 weekStart 轮转出 7 天
    return Array.from({ length: 7 }, (_, i) =>
      fmt.format(new Date(2024, 0, 7 + ((i + weekStart) % 7))),
    );
  }, [locale, lang, weekStart]);

  /** 底部那行「今日：农历九月初七 · 丙午年」 */
  const summary = useMemo(() => todaySummary(), []);

  /** 翻月。用 Date 归一化，12 月 +1 会自动变成明年 1 月 */
  const shift = (delta: number) => {
    setView((v) => {
      const d = new Date(v.year, v.month - 1 + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() + 1 };
    });
  };

  /** 回到今天所在的月份 */
  const goToday = () => {
    const d = new Date();
    setView({ year: d.getFullYear(), month: d.getMonth() + 1 });
  };

  /**
   * 点面板外面 / 按 Esc 关闭。
   *
   * ⚠️ 要放过「时间按钮」本身。
   *    那个按钮自己会 toggle（开→关）。如果这里也关一次，
   *    事件顺序会变成「capture 阶段先关，然后按钮的 onClick 又开」
   *    —— 点了等于没点，面板赖着不走。
   */
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      if (panelRef.current?.contains(el)) return;
      if (el.closest("[data-calendar-toggle]")) return;
      onClose();
    };

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("mousedown", onDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      data-calendar
      role="dialog"
      aria-label={t("cal.aria")}
      /**
       * ⚠️ bottom-full = bottom:100%，贴着任务栏上沿往上展开。
       *    right-2 让它靠右，和 Win10 一致。
       * ⚠️ 宽度用 min() 兜一下 —— 320px 的窄屏上 330px 会溢出。
       *    这里按视口宽度减 16px 收窄。
       */
      className="absolute bottom-full right-2 mb-2 w-[min(330px,calc(100vw-16px))]
                 origin-bottom-right rounded-[6px] border border-[var(--surface-border)]
                 bg-[var(--surface)] text-[var(--fg)]
                 shadow-[0_8px_28px_rgba(0,0,0,.28)]"
    >
      {/* ── 顶部：年月 + 翻月 + 今天 ── */}
      <div className="flex items-center gap-1 px-3 pb-2 pt-3">
        <div className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{title}</div>

        <button
          type="button"
          aria-label={t("cal.prevMonth")}
          title={t("cal.prevMonth")}
          onClick={() => shift(-1)}
          className="grid h-6 w-6 shrink-0 place-items-center rounded text-[13px]
                     text-[var(--fg-dim)] transition-colors hover:bg-[var(--hover)]"
        >
          ‹
        </button>
        <button
          type="button"
          aria-label={t("cal.nextMonth")}
          title={t("cal.nextMonth")}
          onClick={() => shift(1)}
          className="grid h-6 w-6 shrink-0 place-items-center rounded text-[13px]
                     text-[var(--fg-dim)] transition-colors hover:bg-[var(--hover)]"
        >
          ›
        </button>

        <button
          type="button"
          onClick={goToday}
          className="ml-1 shrink-0 rounded border border-[var(--surface-border)] px-2 py-[3px]
                     text-[11.5px] text-[var(--fg-dim)] transition-colors
                     hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          {t("cal.today")}
        </button>
      </div>

      {/* ── 星期表头 ── */}
      <div className="grid grid-cols-7 px-2 pb-1">
        {weekdayLabels.map((label, i) => (
          <div
            key={i}
            className="text-center text-[10.5px] leading-none text-[var(--fg-faint)]"
          >
            {label}
          </div>
        ))}
      </div>

      {/* ── 42 格 ── */}
      <div className="grid grid-cols-7 gap-y-[1px] px-2 pb-2">
        {cells.map((cell) => (
          <DayCell key={cell.ymd} cell={cell} />
        ))}
      </div>

      {/* ── 底部：今天的农历摘要 ── */}
      <div className="border-t border-[var(--surface-border)] px-3 py-2
                      text-[11px] leading-relaxed text-[var(--fg-faint)]">
        {t("cal.todaySummary", { text: summary })}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   单个日期格
   ════════════════════════════════════════════════════════════════ */

function DayCell({ cell }: { cell: CalendarCell }) {
  /**
   * 小字的颜色：
   *   节气 → 蓝（--accent，和 Win10 主题色一致）
   *   节日 → 红（比节气更"值得注意"）
   *   农历日 → 浅灰，不抢眼
   *
   * ⚠️ 今天的格子是蓝底，所有文字都必须转白，否则红字在深蓝上糊成一团。
   */
  const labelColor = cell.isToday
    ? "text-white/90"
    : cell.labelKind === "festival"
      ? "text-[#c0392b]"
      : cell.labelKind === "jieqi"
        ? "text-[var(--accent)]"
        : "text-[var(--fg-faint)]";

  return (
    <div
      /**
       * ⚠️ title 给完整名称。
       *    格子里塞的是短名（"中秋"而不是"中秋节"），
       *    悬停能看到全称，也方便确认这天到底是不是节日。
       */
      title={`${cell.year}-${String(cell.month).padStart(2, "0")}-${String(cell.day).padStart(2, "0")}  ${cell.labelFull}`}
      className={`flex h-[40px] flex-col items-center justify-center rounded-[3px]
                  transition-colors
                  ${cell.inMonth ? "" : "opacity-35"}
                  ${cell.isToday ? "bg-[var(--accent)]" : "hover:bg-[var(--hover)]"}`}
    >
      <span
        className={`text-[12.5px] leading-none tabular-nums ${
          cell.isToday ? "font-semibold text-white" : "text-[var(--fg)]"
        }`}
      >
        {cell.day}
      </span>
      <span className={`mt-[3px] max-w-full truncate text-[9.5px] leading-none ${labelColor}`}>
        {cell.label}
      </span>
    </div>
  );
}
