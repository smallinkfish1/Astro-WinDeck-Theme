import { useEffect, useState } from "react";
import { localeFor, useT } from "../i18n";
import { useI18nStore } from "../i18n/store";

export interface ClockTime {
  /** 时间。24 小时制是 22:24，12 小时制是「下午10:24」或「10:24 PM」 */
  time: string;
  /** 日期。格式跟随「语言 + 地区格式」两个设置，如 2026/10/2 或 10/2/2026 */
  date: string;
  /**
   * 星期几的序号（0 = 星期日）。
   *
   * ⚠️ 这里存的是【序号】而不是"星期五"这样的文字 ——
   *    文字要跟着界面语言变，而下面那个每秒跑的定时器拿不到 t()。
   *    一旦把文字存进 state，用户切语言时它不会重算，
   *    任务栏会一直显示切换前的语言。
   *    存序号、由调用方在渲染时用 WEEKDAY_KEYS 取文字，就没有这个问题。
   */
  weekdayIndex: number;
}

/**
 * 读一次当前时间。
 *
 * ⚠️ 日期格式不再用 `年/月/日` 拼字符串，而是交给 Intl。
 *
 *    原来的写法：`${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
 *    这等于把中文习惯的日期格式写死了 —— 英文用户也会看到 2026/10/2，
 *    而他们习惯的是 10/2/2026。
 *
 *    这里把 locale 作为参数传进来，而不是在函数内部读 store：
 *    保持它是个纯函数，好推理，也便于以后单独测试。
 */
function read(locale: string, hour24: boolean): ClockTime {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");

  /**
   * ⚠️ 24 小时制【自己拼】，不用 Intl。
   *
   *    实测：zh-CN + hour12:false 在早上 9 点会输出 "9:05" —— 不补零。
   *    而任务栏时钟的习惯是两位 "09:05"，少了那个 0 会显得不整齐，
   *    而且每小时宽度都在变，数字会左右跳。
   *    自己 padStart 两位最省事，跨浏览器也一致。
   *
   * ⚠️ 12 小时制【必须】用 Intl。
   *
   *    "上午/下午" 和 "AM/PM" 的写法和位置跟语言绑死：
   *      zh-CN → 下午10:24（前缀，无空格）
   *      en-US → 10:24 PM（后缀，有空格）
   *    自己拼就得维护一张语言映射表，还得处理 RTL 语言的前后缀 ——
   *    交给 Intl 是免费的。
   */
  const time = hour24
    ? `${p(d.getHours())}:${p(d.getMinutes())}`
    : new Intl.DateTimeFormat(locale, {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(d);

  return {
    time,
    date: new Intl.DateTimeFormat(locale, {
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).format(d),
    weekdayIndex: d.getDay(),
  };
}

/**
 * 实时时钟。
 *
 * 两个必须做对的地方：
 *  1. 初始值用 read() 而不是空字符串 —— 否则首帧显示空白，会闪一下。
 *  2. 定时器要在卸载时清掉，否则热更新时会累积出好几个定时器叠加跑。
 *
 * 刷新间隔用 1000ms 而不是 60000ms：虽然只显示到分钟，
 * 但秒级轮询能保证跨分钟的那一下几乎是瞬时跳变，
 * 不会出现"时钟比真实时间慢最多 59 秒"的观感问题。
 *
 * ⚠️ locale 变化（用户切语言、或开关「地区格式」）时要重算，
 *    所以它在 useEffect 的依赖里 —— 否则改完设置得等下一分钟才生效。
 */
export function useClock(intervalMs = 1000): ClockTime {
  const { lang, regional } = useT();
  const locale = localeFor(lang, regional);

  /**
   * ⚠️ hour24 单独订阅，不从 useT() 里取。
   *
   *    useT() 只返回 { lang, regional, t } —— 它是给文案用的。
   *    hour24 是时间格式，跟语言无关，所以直接读 store。
   *    两者都会触发组件重渲染，因为都是 zustand 的订阅。
   */
  const hour24 = useI18nStore((s) => s.hour24);

  const [now, setNow] = useState<ClockTime>(() => read(locale, hour24));

  useEffect(() => {
    // 换 locale / 开关 24 小时制后先立刻重算一次，别等下一跳
    setNow(read(locale, hour24));
    const id = window.setInterval(() => setNow(read(locale, hour24)), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, locale, hour24]);

  return now;
}
