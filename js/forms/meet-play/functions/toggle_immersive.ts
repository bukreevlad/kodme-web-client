// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем типы
import type { MeetPlay } from "../index.js";

/**
 * ***************************************************************************
 * Переключает «immersive»-режим конференции: шапка и футер уезжают,
 * остаётся только сетка участников.
 *
 * Включается только пунктом меню (решение пользователя): клик по свободному
 * месту сетки не переключает режим, иначе одно случайное движение мыши
 * прятало бы управление, а второе — возвращало его обратно. Выход — Esc.
 *
 * Само скрытие сделано в CSS через прозрачность и сдвиг (см. раздел 8
 * css/forms/meet-play.css): ни `display: none`, ни класс `hidden` не
 * анимируются, а панели должны уезжать, а не исчезать.
 *
 * Здесь обнуляются отступы контента. Обе панели абсолютные, поэтому в
 * раскладке места не занимают, и освобождать нечего — но у контента есть
 * `pt/pb-[var(--form-header-height)/(--form-footer-height)]`, и без сброса
 * сетка осталась бы с пустым отступом там, где только что была шапка.
 * Значения выставил `Overlay` при открытии формы, когда панели были видны.
 * @param form - Экземпляр формы MeetPlay.
 * @param force - Принудительное состояние: true — уйти в immersive,
 *                false — вернуть панели. null — переключает.
 * @returns void
 * ***************************************************************************
 */
export function toggleImmersive(form: MeetPlay, force: boolean | null = null): void {

    try {

        if (!form?.tpl) return;

        // ---------- СОСТОЯНИЕ ----------
        const isImmersive = force === null ? !form.isImmersive : Boolean(force);
        const wasChanged = form.isImmersive !== isImmersive;
        form.isImmersive = isImmersive;

        // ---------- ПАНЕЛИ ----------
        // Класс висит на корне формы: от него зависят обе панели,
        // поэтому переключаем один раз
        form.tpl.classList.toggle("meet-play-immersive", isImmersive);

        // ---------- ОТСТУПЫ КОНТЕНТА ----------
        // Меряем панели в обычном состоянии. `offsetHeight` не зависит от
        // того, уехала ли панель за экран: это высота раскладки, а не
        // видимость, — поэтому мерять можно и в immersive, результат
        // тот же. Значение нужно заранее, до переключения класса: после
        // переключения анимация уже пошла бы в сторону нулей.
        const header = form.tpl.querySelector<HTMLElement>(":scope >.header");
        const footer = form.tpl.querySelector<HTMLElement>(":scope >.footer");

        // Сразу выставляем конечные значения: пока идёт переход, панели
        // ещё имеют высоту, и сетка дёрнулась бы и тут же вернулась
        form.tpl.style.setProperty(
            "--form-header-height",
            `${isImmersive ? 0 : (header?.offsetHeight || 0)}px`
        );
        form.tpl.style.setProperty(
            "--form-footer-height",
            `${isImmersive ? 0 : (footer?.offsetHeight || 0)}px`
        );

        // ---------- ДОСТУПНОСТЬ ----------
        // Скрытые панели не должны попадать в порядок обхода фокусом:
        // иначе Tab уводит пользователя на невидимую кнопку выхода.
        // `inert` заодно гасит перехват кликов — у «пилюли» футера
        // стоит `pointer-events: auto`, так что одной прозрачности мало
        for (const panel of [header, footer]) {
            panel?.toggleAttribute("inert", isImmersive);
        }

        // ---------- ПОДСКАЗКА ----------
        // В immersive не видно ни шапки, ни футера, поэтому единственный
        // известный пользователю способ вернуть панели — Escape.
        // Без подсказки режим выглядит как «у меня сломался интерфейс».
        if (wasChanged && isImmersive) {
            try {
                const hint = window._lc?.forms?.meet_play?.immersive_hint;
                if (hint) {
                    Toast.info(hint, {
                        duration: 4000, position: "bottom-center"
                    });
                }
            } catch (_) {
                // Игнорируем: тост — необязательная подсказка
            }
        }

    } catch (error) {
        Logger.error("🚨 [meet-play]: Не удалось переключить immersive-режим:", error);
    }

}
