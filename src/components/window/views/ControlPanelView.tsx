import { useState, useEffect } from "react";
import { useAppearance } from "../../../hooks/useAppearance";
import {
  SETTINGS_SECTIONS,
  normalizeSection,
  type SettingsSection,
} from "../../../lib/settings-sections";
import { useT } from "../../../i18n";
import type { Dict, Lang } from "../../../i18n/types";
import { LANG_LABELS, LANGS } from "../../../i18n/types";
import { useI18nStore } from "../../../i18n/store";
import WallpaperPicker from "./WallpaperPicker";

/**
 * 控制面板 —— 仿 Win10「设置」的左右分栏布局
 * ================================================================
 *
 *   左：分类导航（外观 / 关于 / 语言和区域 / 更新日志）
 *   右：当前分类的设置项
 *
 * 点左边换右边，**在同一个窗口内**切换 —— 不新开窗口。
 *
 * ── 分类清单为什么在 lib/settings-sections.ts 里？ ──
 *
 *   因为同一份清单要被三处使用：这里的左导航、WindowManager 的路由还原、
 *   以及静态页的 getStaticPaths。写三份必然漂移（详见那个文件的说明）。
 *
 * ── 关于「实现状态」 ──
 *
 *   已经实现的（外观 / 关于 / 语言和区域）走真实 UI；
 *   没实现的（更新日志）显示「功能开发中…」。
 *
 * ⚠️ 为什么没实现的不干脆隐藏掉？
 *    因为 Win10 的设置面板就是全列的 —— 用户能看见"有这么个东西，
 *    只是还没做"，比"整个菜单项不存在"信息量大。
 *    而且这让以后补功能变成改一个 ready: true，
 *    不需要动布局，也不需要重新设计导航。
 *
 * ⚠️⚠️ 一个容易踩的坑：单项开关组件必须写成【受控】的（value + onChange），
 *    不要在组件内部存 state。真实数据源是 <html> 上的 class，
 *    组件里再存一份就会不同步 —— 典型症状是按浏览器后退键回到
 *    这一页时，开关显示的状态是错的。
 *
 * ── 这个文件的多语言改造（本次新增） ──
 *
 *   所有写死的中文都换成了 t("cp.xxx")。
 *   ⚠️ 分类的名字比较特殊：它来自 settings-sections.ts 的配置对象，
 *      而那个对象在【模块顶层】就被创建了 —— 那时还没有 t 可用。
 *      所以配置里存的是 nameKey（key 字符串），在这里才 t(s.nameKey)。
 *      详见 settings-sections.ts 里对 nameKey 的说明。
 */

/** 一行设置项：左边标题+说明，右边开关 */
function ToggleRow({
  title,
  desc,
  value,
  onChange,
  disabled,
}: {
  title: string;
  desc: string;
  value: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <div className={`flex items-center gap-4 py-3 ${disabled ? "opacity-50" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-[var(--fg)]">{title}</div>
        <div className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--fg-faint)]">{desc}</div>
      </div>

      {/*
        Win10 的开关是「药丸形轨道 + 圆形滑块」。
        这里用 button 而不是 input[type=checkbox]：
        因为要完全控制视觉，原生 checkbox 在不同浏览器里长得不一样，
        重置样式的成本比直接画一个还高。

        无障碍靠 role="switch" + aria-checked 补齐 —— 这样屏幕阅读器
        依然能正确朗读成"开关，已开启"。
      */}
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={title}
        disabled={disabled}
        onClick={onChange}
        className={`relative h-[20px] w-[44px] shrink-0 rounded-full border transition-colors
                    duration-150
                    ${
                      value
                        ? "border-[var(--accent)] bg-[var(--accent)]"
                        : "border-[var(--surface-border)] bg-transparent"
                    }
                    ${disabled ? "cursor-not-allowed" : ""}`}
      >
        <span
          className={`absolute top-[3px] h-[12px] w-[12px] rounded-full transition-all duration-150
                      ${value ? "left-[27px] bg-white" : "left-[3px] bg-[var(--fg-dim)]"}`}
        />
      </button>
    </div>
  );
}

/** 二选一分段按钮（亮色 / 暗色）。Win10 设置里常用这种，比开关更明确 */
function SegmentedRow({
  title,
  desc,
  options,
  value,
  onChange,
}: {
  title: string;
  desc: string;
  options: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-[var(--fg)]">{title}</div>
        <div className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--fg-faint)]">{desc}</div>
      </div>

      <div className="flex shrink-0 overflow-hidden rounded border border-[var(--surface-border)]">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={value === o.id}
            onClick={() => onChange(o.id)}
            className={`px-3 py-1 text-[12px] transition-colors ${
              value === o.id
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--fg-dim)] hover:bg-[var(--hover)]"
            }`}
          >
            {o.name}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * 下拉选择行（语言用的就是这个）。
 *
 * ⚠️ 为什么单独做一个，不复用 SegmentedRow？
 *    因为分段控件在选项多于 2~3 个时会挤成一排小按钮，很难点；
 *    而语言未来是要扩展的（日、韩…），下拉能容纳任意多。
 *    在只有两种语言时看着有点"重"，但省下了以后重做布局的成本。
 */
function SelectRow({
  title,
  desc,
  options,
  value,
  onChange,
}: {
  title: string;
  desc: string;
  options: { id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex items-center gap-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="text-[13px] text-[var(--fg)]">{title}</div>
        <div className="mt-0.5 text-[11.5px] leading-relaxed text-[var(--fg-faint)]">{desc}</div>
      </div>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={title}
        className="min-w-[130px] shrink-0 rounded border border-[var(--surface-border)]
                   bg-[var(--surface)] px-2 py-1 text-[12px] text-[var(--fg)] outline-none
                   transition-colors focus:border-[var(--accent)]"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}

/** 段落小标题 */
function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mt-1 mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--fg-faint)]">
      {children}
    </h4>
  );
}

/** 未实现分类的占位内容 */
function PlaceholderPage({ section }: { section: SettingsSection }) {
  const { t } = useT();
  return (
    <div className="grid h-full min-h-[220px] place-items-center">
      <div className="text-center">
        <div className="text-[32px] leading-none opacity-40">{section.icon}</div>
        <div className="mt-4 text-[14px] text-[var(--fg)]">{t(section.nameKey as keyof Dict)}</div>
        <div className="mt-2 text-[12.5px] text-[var(--fg-dim)]">{t("cp.inDevelopment")}</div>
        <p className="mx-auto mt-4 max-w-[320px] text-[11.5px] leading-relaxed text-[var(--fg-faint)]">
          {t(section.descKey as keyof Dict)}
        </p>
      </div>
    </div>
  );
}

/** 「外观」页 —— 这个面板的核心功能 */
function AppearancePage() {
  const {
    theme,
    acrylic,
    anim,
    menuDark,
    wallpaper,
    setThemeMode,
    toggleAcrylic,
    toggleAnim,
    toggleMenuDark,
    setWallpaperMode,
    reset,
  } = useAppearance();
  const { t } = useT();

  return (
    <div className="flex flex-col gap-3">
      <section>
        <h3 className="text-[15px] font-semibold text-[var(--fg)]">{t("cp.nav.appearance")}</h3>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--fg-dim)]">
          {t("cp.appearance.lead")}
        </p>
      </section>

      {/* ── 壁纸 ── */}
      <section className="border-t border-[var(--surface-border)] pt-3">
        <GroupTitle>{t("cp.wallpaper")}</GroupTitle>
        <div className="mt-2">
          <WallpaperPicker value={wallpaper} onChange={setWallpaperMode} />
        </div>
      </section>

      {/* ── 颜色 ── */}
      <section className="border-t border-[var(--surface-border)] pt-3">
        <GroupTitle>{t("cp.colors")}</GroupTitle>

        <SegmentedRow
          title={t("cp.appMode")}
          desc={t("cp.appModeDesc")}
          options={[
            { id: "light", name: t("cp.light") },
            { id: "dark", name: t("cp.dark") },
          ]}
          value={theme}
          onChange={(id) => setThemeMode(id as "light" | "dark")}
        />

        <ToggleRow
          title={t("cp.startMenuDark")}
          desc={t("cp.startMenuDarkDesc")}
          value={menuDark}
          onChange={toggleMenuDark}
        />
      </section>

      {/* ── 效果 ── */}
      <section className="border-t border-[var(--surface-border)] pt-3">
        <GroupTitle>{t("cp.effects")}</GroupTitle>

        <ToggleRow
          title={t("cp.acrylic")}
          desc={t("cp.acrylicDesc")}
          value={acrylic}
          onChange={toggleAcrylic}
        />

        <ToggleRow
          title={t("cp.anim")}
          desc={t("cp.animDesc")}
          value={anim}
          onChange={toggleAnim}
        />
      </section>

      {/* ── 重置 ── */}
      <section className="border-t border-[var(--surface-border)] pt-3">
        <button
          type="button"
          onClick={reset}
          className="rounded border border-[var(--surface-border)] px-3 py-1.5 text-[12px]
                     text-[var(--fg-dim)] transition-colors
                     hover:bg-[var(--hover)] hover:text-[var(--fg)]"
        >
          {t("cp.reset")}
        </button>
        <span className="ml-3 text-[11px] text-[var(--fg-faint)]">{t("cp.resetHint")}</span>
      </section>
    </div>
  );
}

/** 「关于」页 */
function AboutPage() {
  const { t } = useT();

  const rows: { k: keyof Dict; v: keyof Dict }[] = [
    { k: "cp.kb.position", v: "cp.v.position" },
    { k: "cp.kb.stack", v: "cp.v.stack" },
    { k: "cp.kb.theming", v: "cp.v.theming" },
    { k: "cp.kb.render", v: "cp.v.render" },
    { k: "cp.kb.data", v: "cp.v.data" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <section>
        <h3 className="text-[15px] font-semibold text-[var(--fg)]">{t("cp.nav.about")}</h3>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--fg-dim)]">
          {t("cp.aboutLead")}
        </p>
      </section>

      <section className="border-t border-[var(--surface-border)] pt-3">
        <GroupTitle>{t("cp.overview")}</GroupTitle>
        <dl className="mt-2 divide-y divide-[var(--surface-border)]">
          {rows.map((r) => (
            <div key={r.k} className="flex gap-4 py-2">
              <dt className="w-[76px] shrink-0 text-[12px] text-[var(--fg-faint)]">{t(r.k)}</dt>
              <dd className="min-w-0 flex-1 text-[12.5px] text-[var(--fg-dim)]">{t(r.v)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="border-t border-[var(--surface-border)] pt-3">
        <GroupTitle>{t("cp.notes")}</GroupTitle>
        <ul className="mt-2 space-y-1.5 text-[11.5px] leading-relaxed text-[var(--fg-faint)]">
          <li>{t("cp.note1")}</li>
          <li>{t("cp.note2")}</li>
          <li>{t("cp.note3")}</li>
        </ul>
      </section>
    </div>
  );
}

/**
 * 「语言和区域」页 —— 本次新增的功能主体。
 *
 * ⚠️ 这个页面是语言切换的【唯一入口】。它做两件事：
 *      1. 下拉选语言  → useI18nStore.setLang()，立刻全局生效
 *      2. 地区格式开关 → useI18nStore.setRegional()
 *
 * ⚠️⚠️ 语言下拉的值直接写进 zustand store，不是本地 state。
 *      因为它影响的是【整个桌面】，包括另一个岛屿里的任务栏 ——
 *      只有全局 store 能穿透 island 边界把变更广播出去。
 *      这也正是这个功能能用而被做出来的全部原因。
 */
function LanguagePage() {
  const { t } = useT();
  const lang = useI18nStore((s) => s.lang);
  const regional = useI18nStore((s) => s.regional);
  const hour24 = useI18nStore((s) => s.hour24);
  const setLang = useI18nStore((s) => s.setLang);
  const setRegional = useI18nStore((s) => s.setRegional);
  const setHour24 = useI18nStore((s) => s.setHour24);

  return (
    <div className="flex flex-col gap-3">
      <section>
        <h3 className="text-[15px] font-semibold text-[var(--fg)]">{t("lang.title")}</h3>
        <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--fg-dim)]">{t("lang.lead")}</p>
      </section>

      <section className="border-t border-[var(--surface-border)] pt-3">
        <SelectRow
          title={t("lang.displayLanguage")}
          desc={t("lang.displayLanguageDesc")}
          options={LANGS.map((l) => ({ id: l, name: LANG_LABELS[l] }))}
          value={lang}
          onChange={(id) => setLang(id as Lang)}
        />

        <ToggleRow
          title={t("lang.regionalFormat")}
          desc={t("lang.regionalFormatDesc")}
          value={regional}
          onChange={() => setRegional(!regional)}
        />

        {/*
          24 小时制。
          ⚠️ 和上面「地区格式」是【两个独立开关】，别合并成一个：
             真实 Windows 里时间格式和地区也分得开。
          ⚠️ 改完立刻生效 —— useClock 订阅了 hour24，
             store 一变，任务栏下一帧就重算。
        */}
        <ToggleRow
          title={t("lang.hour24")}
          desc={t("lang.hour24Desc")}
          value={hour24}
          onChange={() => setHour24(!hour24)}
        />
      </section>

      <section className="border-t border-[var(--surface-border)] pt-3">
        <ul className="space-y-1.5 text-[11.5px] leading-relaxed text-[var(--fg-faint)]">
          <li>{t("lang.note1")}</li>
          <li>{t("lang.note2")}</li>
          <li>{t("lang.note3")}</li>
        </ul>
      </section>
    </div>
  );
}

export default function ControlPanelView({ section }: { section?: string }) {
  const { t } = useT();

  /**
   * 当前分类。
   *
   * ⚠️⚠️ 这里有一对【互相驱动】的状态，必须理清楚谁听谁的：
   *
   *    · 外部传进来的 section（来自 URL / 打开窗口时的参数）是【指挥棒】。
   *      用户从 /settings/changelog 进来，就应该落在更新日志页。
   *
   *    · 内部点击导航产生的新值，要通过事件【回报给 WindowManager】，
   *      由它去改 URL —— 不能只改本地 state，那样地址栏就和界面不一致了，
   *      用户刷新一下就回到了旧分类。
   *
   *    所以：内部只存一个"当前显示的是什么"，
   *    点击时既 setState 又派发事件；外部 section 变化时同步进来。
   *
   * ⚠️ 为什么用 useEffect 同步而不是直接 useState(section)？
   *    因为 useState 的初值只在【首次挂载】时取一次。
   *    如果父组件之后把 section 从 appearance 改成 about
   *    （比如用户按了浏览器后退），组件不会重新挂载，
   *    初值也不会重新算 —— 界面就会停在旧分类上。
   */
  const [current, setCurrent] = useState(() => normalizeSection(section));

  useEffect(() => {
    setCurrent(normalizeSection(section));
  }, [section]);

  /**
   * 点左侧导航。
   *
   * ⚠️ 派发的事件名是 "os:switch-settings"，由 WindowManager 监听。
   *    为什么不让这里直接改 URL？
   *      因为改 URL 必须连带更新窗口标题、以及（将来的）面包屑，
   *      那是窗口层的职责。让视图层直接动 history 会造成
   *      "URL 变了但窗口标题没变"这种割裂。
   *    统一走事件，窗口层一处处理。
   */
  const pick = (id: string) => {
    setCurrent(id);
    window.dispatchEvent(new CustomEvent("os:switch-settings", { detail: { section: id } }));
  };

  const active = SETTINGS_SECTIONS.find((s) => s.id === current) ?? SETTINGS_SECTIONS[0];

  return (
    <div className="flex h-full min-h-0">
      {/* ────────────────── 左：分类导航 ────────────────── */}
      <nav
        aria-label={t("cp.navAria")}
        className="flex w-[168px] shrink-0 flex-col gap-0.5 overflow-y-auto
                   border-r border-[var(--surface-border)] bg-[var(--surface-2)] p-2"
      >
        {SETTINGS_SECTIONS.map((s) => {
          const on = s.id === active.id;
          return (
            <button
              key={s.id}
              type="button"
              aria-current={on ? "page" : undefined}
              onClick={() => pick(s.id)}
              className={`relative flex items-center gap-2.5 rounded px-2.5 py-2 text-left
                          transition-colors
                          ${on ? "bg-[var(--active)]" : "hover:bg-[var(--hover)]"}`}
            >
              {/*
                Win10 设置里的"当前项左侧有一条强调色竖线"。
                用绝对定位的伪元素实现，不占布局宽度 ——
                如果写成 border-left，选中/未选中之间会有 2px 的位移，
                文字会左右跳，很廉价。
              */}
              <span
                aria-hidden="true"
                className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-[var(--accent)]
                            transition-opacity ${on ? "opacity-100" : "opacity-0"}`}
              />

              <span className="w-4 shrink-0 text-center text-[13px] leading-none">{s.icon}</span>
              <span
                className={`min-w-0 flex-1 truncate text-[12.5px] ${
                  on ? "text-[var(--fg)]" : "text-[var(--fg-dim)]"
                }`}
              >
                {t(s.nameKey as keyof Dict)}
              </span>
              {/* 未实现的给个浅色小点，比整项置灰更轻 */}
              {!s.ready && (
                <span
                  aria-hidden="true"
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--fg-faint)] opacity-50"
                  title={t("cp.inDevelopment")}
                />
              )}
            </button>
          );
        })}

        <div className="mt-auto px-2.5 pt-2 text-[10.5px] leading-relaxed text-[var(--fg-faint)]">
          {t("cp.savedLocally")}
        </div>
      </nav>

      {/* ────────────────── 右：当前分类的内容 ────────────────── */}
      <div className="min-w-0 flex-1 overflow-y-auto p-4">
        {active.id === "appearance" && <AppearancePage />}
        {active.id === "about" && <AboutPage />}
        {active.id === "language" && <LanguagePage />}
        {!active.ready && <PlaceholderPage section={active} />}
      </div>
    </div>
  );
}
