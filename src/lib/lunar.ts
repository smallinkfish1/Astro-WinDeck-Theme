/**
 * 农历日历数据层
 * ================================================================
 *
 * 这一层只干一件事：把 lunar-typescript 算出来的东西，
 * 整理成日历面板直接能画的结构。
 *
 * ── 为什么要把库包一层，而不是组件里直接调 ──
 *
 *   因为库有两个坑，必须只在一个地方处理掉，不能漏到 UI 里：
 *
 *   ①【跨月会抛异常】
 *      Solar.fromYmd(2026, 10, -3) 直接 throw "wrong day -3"。
 *      而日历的 42 格必然包含上月末、下月初的补位日期。
 *      正确做法是交给 JS 的 Date 归一化，再用 Solar.fromDate()。
 *
 *   ②【getJieQiTable 的键名混了中文和拼音】
 *      同一张表里既有 "冬至" = 2025-12-21，也有 "DONG_ZHI" = 2026-12-22。
 *      按名字取会静默拿到上一年的节气，不报错、就是日期差一年。
 *      所以这里一律用逐日扫描 l.getJieQi()，不用查表。
 *
 * ── 为什么农历文案不翻译 ──
 *
 *   产品决定：切到英文时农历保持中文（"初一""霜降"）。
 *   理由是农历本来就是中文概念，硬译成 "Day 7" / "Frost's Descent"
 *   反而像半成品。所以这个文件返回的全部是中文文案，不进词典。
 *
 *   日历【界面】的文案（今天、上个月、星期三…）照常走 t()。
 */
import { Solar } from "lunar-typescript";

/**
 * 要显示的节日白名单。
 *
 * ⚠️ 为什么用白名单而不是黑名单：
 *    库的 getFestivals() 会返回「世界住房日」「全国中小学生安全教育日」
 *    「万圣节前夜」这类 —— 全标出来格子会很挤，而且大部分用户不关心。
 *
 * ⚠️ 名字必须和库的输出完全一致（带"节"字），否则匹配不上。
 *    这份名单是扫了 2026 全年实际输出之后定的，不是猜的。
 *
 * ⚠️ 清明不在这里 —— 它是节气，由 getJieQi() 返回，已经能显示。
 *    放进来的话会和节气重复标两次。
 */
const FESTIVALS = new Set([
  // ── 公历：中国法定节日 ──
  "元旦节",
  "劳动节",
  "国庆节",
  // ── 农历：中国传统节日 ──
  "腊八节",
  "除夕",
  "春节",
  "元宵节",
  "龙头节",
  "端午节",
  "七夕节",
  "中秋节",
  "重阳节",
]);

/**
 * 节日在格子里的短名。
 *
 * ⚠️ 为什么要单独一张映射表，而不是统一去掉"节"字：
 *    "春节" 去掉就变成 "春"，意思完全变了；
 *    "中秋节" 去掉才是想要的 "中秋"。
 *    只能一个个写。
 *
 * ⚠️ 保持 2-3 个字：格子最窄只有 40 多像素，
 *    四个字会被挤成两行或者溢出。
 */
const FESTIVAL_SHORT: Record<string, string> = {
  元旦节: "元旦",
  劳动节: "劳动",
  国庆节: "国庆",
  腊八节: "腊八",
  除夕: "除夕",
  春节: "春节",
  元宵节: "元宵",
  龙头节: "龙抬头",
  端午节: "端午",
  七夕节: "七夕",
  中秋节: "中秋",
  重阳节: "重阳",
};

/** 日历格子里那行小字的性质 —— UI 靠它决定颜色 */
export type LabelKind = "jieqi" | "festival" | "lunar";

export interface CalendarCell {
  year: number;
  /** 1-12 */
  month: number;
  day: number;
  /** "2026-10-16"，用来和今天比较 */
  ymd: string;
  /** 是否属于当前显示的月份（false = 上月末/下月初的补位） */
  inMonth: boolean;

  /** 农历日数字 1..30 */
  lunarDay: number;
  /** 农历日中文（初一 / 廿三） */
  lunarDayCn: string;
  /** 农历月中文（正 / 九 / 闰六） */
  lunarMonthCn: string;
  /** 是否农历初一 —— 初一要显示月名而不是"初一" */
  isLunarFirst: boolean;

  /** 节气名，没有就是 null */
  jieQi: string | null;
  /** 命中的节日（原始名，可能多个） */
  festivals: string[];

  /**
   * 格子里那行小字，已经按优先级选好了。
   *
   * 优先级：节日 > 节气 > 农历日（初一显示月名）
   * 理由：中秋比"八月十五"更值得让人看见；清明是节气，
   *       自然走节气那条分支。
   */
  label: string;
  labelKind: LabelKind;
  /** 完整名称，给 title 悬停提示用 */
  labelFull: string;

  /** 是否今天 */
  isToday: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 本地日期 → "YYYY-MM-DD"。⚠️ 不能用 toISOString——它会转成 UTC，东八区会差一天 */
function ymdOf(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * 今天。
 *
 * ⚠️ 每次调用都重新取 —— 不要在模块顶层算一次存起来。
 *    页面开着过午夜之后，"今天"就变了。
 */
function todayYmd(): string {
  return ymdOf(new Date());
}

/**
 * 生成某个月的 42 格。
 *
 * @param year     公历年
 * @param month    公历月 1..12
 * @param weekStart 一周从周几开始：0 = 周日，1 = 周一
 *                  （中文习惯周一开头，英文习惯周日开头）
 *
 * ⚠️ 固定 42 格（6 行）而不是 35/42 自适应：
 *    否则切月份时面板高度会跳一下，很难看。
 */
export function buildMonth(year: number, month: number, weekStart: 0 | 1 = 1): CalendarCell[] {
  const today = todayYmd();

  /**
   * 当月 1 号是周几 → 前面要补几格。
   *
   * ⚠️ (x - weekStart + 7) % 7 是处理"负数取模"的标准写法。
   *    JS 的 % 对负数返回负值（-1 % 7 === -1），直接减会算错。
   */
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const offset = (firstWeekday - weekStart + 7) % 7;

  const cells: CalendarCell[] = [];

  for (let i = 0; i < 42; i++) {
    /**
     * ⚠️⚠️ 关键：交给 Date 去归一化。
     *
     *    i - offset + 1 可能是 0、-3、40 这种"月外"的数字。
     *    直接塞给 Solar.fromYmd() 会抛异常；
     *    new Date(2026, 9, -3) 会自动变成 2026-09-27。
     *    这是整个日历最容易写错的一行。
     */
    const date = new Date(year, month - 1, i - offset + 1);

    // Solar.fromDate 而不是 fromYmd —— 原因见上
    const solar = Solar.fromDate(date);
    const lunar = solar.getLunar();

    const jieQi = lunar.getJieQi() || null;

    /**
     * ⚠️ 公历节日在 Solar 上，农历节日在 Lunar 上，要合并。
     *    然后用白名单过滤，把「世界住房日」这类挡掉。
     */
    const festivals = [...solar.getFestivals(), ...lunar.getFestivals()].filter((f) =>
      FESTIVALS.has(f),
    );

    const isLunarFirst = lunar.getDay() === 1;

    /* ── 选那行小字 ── */
    let label: string;
    let labelKind: LabelKind;
    let labelFull: string;

    if (festivals.length) {
      labelFull = festivals[0];
      label = FESTIVAL_SHORT[festivals[0]] ?? festivals[0];
      labelKind = "festival";
    } else if (jieQi) {
      label = jieQi;
      labelFull = jieQi;
      labelKind = "jieqi";
    } else if (isLunarFirst) {
      // 农历初一显示月名，这是日历的惯例（否则满屏"初一"没法分辨月份）
      label = `${lunar.getMonthInChinese()}月`;
      labelFull = label;
      labelKind = "lunar";
    } else {
      label = lunar.getDayInChinese();
      labelFull = label;
      labelKind = "lunar";
    }

    const ymd = ymdOf(date);

    cells.push({
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      ymd,
      inMonth: date.getMonth() === month - 1,
      lunarDay: lunar.getDay(),
      lunarDayCn: lunar.getDayInChinese(),
      lunarMonthCn: lunar.getMonthInChinese(),
      isLunarFirst,
      jieQi,
      festivals,
      label,
      labelKind,
      labelFull,
      isToday: ymd === today,
    });
  }

  return cells;
}

/**
 * 今天那一格的农历摘要，给面板底部用。
 *
 * 例如：「农历九月初七 · 丙午年」
 *
 * ⚠️ 年份用【干支】而不是 getYearInChinese()。
 *    getYearInChinese() 返回的是 "二〇二六" —— 把数字念一遍，
 *    放在日历里很怪；农历语境下人们说的是"丙午年"。
 *    getYearInGanZhi() 才是"丙午"。
 *
 * ⚠️ 单独算一次，而不是从 42 格里找 —— 因为面板可能翻到了别的月份，
 *    而底部那行永远说的是"今天"。
 */
export function todaySummary(): string {
  const lunar = Solar.fromDate(new Date()).getLunar();
  return `农历${lunar.getMonthInChinese()}月${lunar.getDayInChinese()} · ${lunar.getYearInGanZhi()}年`;
}
