// Импортируем utils
import { Icons } from "../../../utils/icons.js";
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { Call } from "../index.js";
import type { CallQualityLevel } from "../types.js";

/**
 * Оформление уровней качества связи. Ключи совпадают со значениями
 * одноимённого enum `ConnectionQuality` из `livekit-client`
 * (excellent / good / poor / lost / unknown).
 */
export const QUALITY_LEVELS: Record<CallQualityLevel, { icon: string; color: string }> = {
    excellent: { icon: "antenna-bars-4", color: "var(--color-green)" },
    good: { icon: "antenna-bars-3", color: "var(--color-green)" },
    poor: { icon: "antenna-bars-1", color: "var(--color-yellow)" },
    lost: { icon: "antenna-bars-off", color: "var(--color-red)" },
    unknown: { icon: "antenna-bars-off", color: "var(--text-muted)" }
};

/**
 * Guard уровня качества связи: значение приходит извне (LiveKit-enum),
 * поэтому сверяемся со справочником, а не полагаемся на тип.
 * @param value - Проверяемое значение.
 * @returns - Является ли известным уровнем качества.
 */
function isQualityLevel(value: string): value is CallQualityLevel {
    return value in QUALITY_LEVELS;
}

/**
 * ***************************************************************************
 * Рисует индикатор качества связи в шапке звонка.
 *
 * Оценку берём из `ConnectionQuality` самого LiveKit: там метрики уже
 * сведены в уровень с учётом битрейта, jitter и потерь пакетов.
 * @param form - Экземпляр формы.
 * @param quality - Уровень из `ConnectionQuality`.
 * @returns {void}
 * ***************************************************************************
 */
export function updateConnectionQuality(form: Call, quality?: string | null): void {

    try {

        const element = form?.tpl?.querySelector<HTMLElement>(":scope >[data-header] [data-connection-quality]");
        if (!element) return;

        // ---------- ЧТО РИСОВАТЬ ----------
        // «Неизвестно» — нормальное состояние сразу после подключения,
        // пока статистика не накопилась. Молчащий бейдж только пугает
        if (!quality || quality === "unknown") {
            element.classList.add("hidden");
            element.classList.remove("flex");
            form.qualityLevel = null;
            return;
        }

        element.classList.remove("hidden");
        element.classList.add("flex");
        // ---------- ЧТО РИСОВАТЬ ----------

        // ---------- ПОВТОРНЫЙ РЕНДЕР ----------
        // Событие приходит раз в несколько секунд, перерисовывать иконку
        // на каждом тике незачем — только при реальной смене уровня
        const level: CallQualityLevel = isQualityLevel(quality) ? quality : "unknown";
        if (form.qualityLevel === level) return;
        form.qualityLevel = level;

        // ---------- ИКОНКА ----------
        const iconBox = element.querySelector<HTMLElement>(":scope [data-quality-icon]");
        if (iconBox) {
            iconBox.replaceChildren();
            const icon = Icons.icon(QUALITY_LEVELS[level].icon, { classes: ["w-4", "h-4", "shrink-0"] });
            if (icon) iconBox.appendChild(icon);
        }

        // ---------- ЦВЕТ ----------
        element.style.setProperty("--call-quality-color", QUALITY_LEVELS[level].color);

        // ---------- СМЫСЛ УРОВНЯ ----------
        // Текстовой подписи нет — только цветная иконка, но смысл уровня
        // всё же нужен скринридеру и подсказке при наведении
        const levelName = window._lc.forms.call.quality[level] ?? window._lc.forms.call.quality.unknown;
        element.title = levelName;
        element.setAttribute("aria-label", levelName);

    } catch (error) {
        Logger.debug("🚨 [app][call]: Не удалось обновить индикатор качества связи:", error);
    }

}
