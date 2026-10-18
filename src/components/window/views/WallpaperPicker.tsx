import { useState } from "react";
import { WALLPAPERS, type WallpaperItem } from "../../../lib/wallpaper";
import { useT } from "../../../i18n";
import type { Dict } from "../../../i18n/types";

/**
 * 壁纸选择器 —— 控制面板「外观」页里的一格。
 *
 * ── 设计取向 ──
 *
 *   Win10 设置的「背景」页就是一组缩略图网格：点哪张换哪张，
 *   当前那张下面有一条强调色下划线。这里照抄那个交互。
 *
 * ⚠️⚠️ 【关键设计】图片不存在时不报错、不假装能用。
 *
 *   这个项目的壁纸清单是先定好的，图片由你之后往
 *   public/wallpapers/ 里补。所以「图还没放」是一种【正常状态】，
 *   不是错误状态，必须优雅处理：
 *
 *     浏览器加载不存在的图 → <img> 触发 onerror
 *     → 我们把这张卡片标记成 missing
 *     → 显示一个「待补充」占位块，并【禁止选中】
 *
 *   为什么必须禁止选中？
 *     如果允许点，用户点了「极光」→ localStorage 写入 aurora
 *     → <html data-wallpaper="aurora"> → CSS 匹配上了
 *     → var(--wallpaper) 指向一张 404 的图
 *     → 壁纸层什么都不画，露出兜底底色
 *     → 用户看到的是"整个桌面变纯色了"，会以为把系统点坏了。
 *
 *     所以"没图就不能选"这条约束是【必须】的，
 *     它把一次可能让人困惑的失败，变成了一个一眼能懂的"待补充"。
 */

/** 重置 + 通知父组件 */
interface Props {
  /** 当前选中的壁纸 id */
  value: string;
  /** 换壁纸 */
  onChange: (id: string) => void;
}

/**
 * 单张卡片。
 *
 * ⚠️ 为什么把 missing 状态放在卡片【内部】而不是提到父组件统一管？
 *    因为它是纯粹的"这张图的加载结果"，和业务无关。
 *    提上去就要维护一个 Record<string, boolean>，
 *    每张图的状态变化都要触发父组件重渲染 —— 四张图就是四次，
 *    而且父组件还得处理"某张还没加载完"的中间态。
 *    放内部，加载结果是这张卡片自己的事，互不影响。
 */
function WallpaperCard({
  item,
  active,
  onPick,
}: {
  item: WallpaperItem;
  active: boolean;
  onPick: (id: string) => void;
}) {
  /**
   * ⚠️ 缩略图一律用【亮色/单图】版本，不跟当前主题切。
   *
   *    因为用户是在"挑壁纸"，需要能同时看到所有候选，
   *    而不是让一半缩略图变成看不清的暗块。
   *
   * ⚠️ 取值顺序：thumb → image（单图模式）→ light（双图模式的亮版）。
   *    直接写 item.light 的话，三张单图壁纸会全部取不到图。
   */
  const preview = item.thumb ?? item.image ?? item.light ?? "";
  const { t } = useT();
  const [missing, setMissing] = useState(false);

  /** 壁纸名来自词典（清单里存的是 nameKey，见 lib/wallpaper.ts） */
  const label = t(item.nameKey as keyof Dict);

  return (
    <button
      type="button"
      /* 没图就真的不能点 —— 见文件顶部那段说明 */
      disabled={missing}
      onClick={() => onPick(item.id)}
      aria-pressed={active}
      title={missing ? t("cp.wallpaperMissing", { name: label }) : label}
      className={`group relative overflow-hidden rounded border text-left transition-all
                  ${
                    active
                      ? "border-[var(--accent)] ring-2 ring-[var(--accent)] ring-offset-1 ring-offset-[var(--surface)]"
                      : "border-[var(--surface-border)] hover:border-[var(--accent)]"
                  }
                  ${missing ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-[var(--surface-3)]">
        {missing ? (
          /*
            占位块。
            ⚠️ 用「待补充」三个字而不是一个破图图标：
               破图图标传达的是"出错了"，而这里的语义是
               "还没放，属于预期内" —— 措辞不同，用户的心态完全不同。
          */
          <div className="grid h-full w-full place-items-center">
            <div className="text-center">
              <div className="text-[16px] leading-none text-[var(--fg-faint)]">＋</div>
              <div className="mt-1 text-[10.5px] text-[var(--fg-faint)]">
                {t("cp.wallpaperPending")}
              </div>
            </div>
          </div>
        ) : (
          <img
            src={preview}
            alt={label}
            loading="lazy"
            decoding="async"
            onError={() => setMissing(true)}
            className="h-full w-full object-cover transition-transform duration-300
                       group-hover:scale-[1.04]"
          />
        )}
      </div>

      <div className="flex items-center gap-1 px-2 py-1.5">
        <span className="truncate text-[11.5px] text-[var(--fg-dim)]">{label}</span>
        {/* 当前选中给个勾，光靠边框在深色下不够明显 */}
        {active && !missing && (
          <span className="ml-auto shrink-0 text-[11px] text-[var(--accent)]">✓</span>
        )}
        {missing && (
          <span className="ml-auto shrink-0 text-[10px] text-[var(--fg-faint)]">
            {t("cp.wallpaperNotReady")}
          </span>
        )}
      </div>
    </button>
  );
}

export default function WallpaperPicker({ value, onChange }: Props) {
  const { t } = useT();

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {WALLPAPERS.map((w) => (
          <WallpaperCard key={w.id} item={w} active={value === w.id} onPick={onChange} />
        ))}
      </div>

      <p className="mt-3 text-[11px] leading-relaxed text-[var(--fg-faint)]">
        {t("cp.wallpaperHint")}
      </p>
    </div>
  );
}
