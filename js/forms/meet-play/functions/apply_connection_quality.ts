// Импортируем utils
import { Icons } from "../../../utils/icons.js";
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { MeetPlay } from "../index.js";
import { I18n, t } from "../../../utils/i18n/index.js";

/**
 * Уровни качества связи. Ключи совпадают со значениями одноимённого enum
 * `ConnectionQuality` из `livekit-client` (excellent / good / poor / lost / unknown).
 */
export type MeetQualityLevel = "excellent" | "good" | "poor" | "lost" | "unknown";

/**
 * Оформление уровней качества связи.
 *
 * Цвета берём из переменных темы, а не из палитры Tailwind: на красном
 * фоне плохой связи иконка «плохого» уровня должна оставаться такой же
 * контрастной, как в остальном интерфейсе приложения.
 */
export const QUALITY_LEVELS: Record<MeetQualityLevel, { icon: string; color: string }> = {
    excellent: { icon: "antenna-bars-4", color: "var(--color-green)" },
    good: { icon: "antenna-bars-3", color: "var(--color-green)" },
    poor: { icon: "antenna-bars-1", color: "var(--color-yellow)" },
    lost: { icon: "antenna-bars-off", color: "var(--color-red)" },
    unknown: { icon: "antenna-bars-off", color: "var(--text-muted)" }
};

/**
 * Guard: значение — известный уровень качества связи.
 * @param value - Проверяемое значение.
 * @returns true, если значение — уровень из QUALITY_LEVELS.
 */
function isQualityLevel(value: unknown): value is MeetQualityLevel {
    return value === "excellent" || value === "good"
        || value === "poor" || value === "lost" || value === "unknown";
}

/**
 * ***************************************************************************
 * Рисует индикатор качества связи в шапке конференции.
 *
 * Оценку берём не из сырых RTC-статистик, как в форме звонка, а из
 * `ConnectionQuality` самого LiveKit: там метрики уже сведены в
 * уровень с учётом битрейта, jitter и потерь пакетов, и «средний» уровень
 * не выглядит как «среднее» только потому, что метрики сходятся.
 * @param form - Экземпляр формы.
 * @param quality - Уровень из `ConnectionQuality`.
 * @returns void
 * ***************************************************************************
 */
export function updateConnectionQuality(form: MeetPlay, quality?: string | null): void {

    try {

        // ---------- ЧТО РИСОВАТЬ ----------
        // Неизвестный уровень — это не «нет данных для пользователя»,
        // а нормальное состояние сразу после подключения, пока
        // статистика ещё не накопилась. Молчащий бейдж «нет данных»
        // только пугает, поэтому в этом случае индикатор не рисуем.
        const element = form.tpl?.querySelector<HTMLElement>(":scope [data-connection-quality]");
        if (!element) return;

        if (!quality || quality === "unknown") {
            element.classList.add("hidden");
            form.qualityLevel = null;
            return;
        }

        element.classList.remove("hidden");

        // ---------- ПОВТОРНЫЙ РЕНДЕР ----------
        // Событие о качестве приходит по мере накопления статистики,
        // то есть раз в несколько секунд. Перерисовывать иконку на
        // каждом тике незачем — только при реальной смене уровня.
        const level: MeetQualityLevel = isQualityLevel(quality) ? quality : "unknown";
        if (form.qualityLevel === level) return;
        form.qualityLevel = level;

        // ---------- ИКОНКА ----------
        const iconBox = element.querySelector(":scope [data-quality-icon]");
        if (iconBox) {
            iconBox.replaceChildren();
            const icon = Icons.icon(QUALITY_LEVELS[level].icon, { classes: ["w-4", "h-4", "shrink-0"] });
            if (icon) iconBox.appendChild(icon);
        }

        // ---------- ЦВЕТ ----------
        // Цвет вешаем на сам элемент: в CSS у него завязан фон
        // (`color-mix` от `--meet-quality-color`), поэтому одного
        // переопределения `color` хватает и для иконки, и для подписи
        const color = QUALITY_LEVELS[level].color;
        element.style.setProperty("--meet-quality-color", color);

        // ---------- ПОДПИСЬ ----------
        const label = element.querySelector(":scope [data-quality-label]");
        if (label) {
            label.textContent = I18n.tree.forms.meet_play.quality[level] ?? t("forms.meet_play.quality.unknown");
            element.title = label.textContent;
        }

    } catch (error) {
        Logger.debug("🚨 [meet-play]: Не удалось обновить индикатор качества связи:", error);
    }

}
