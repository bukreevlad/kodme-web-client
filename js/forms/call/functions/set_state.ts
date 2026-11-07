// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { syncSelfTileVisibility } from "./self_view.js";

// Импортируем типы
import type { Call } from "../index.js";
import type { CallState } from "../types.js";

/**
 * Состояния звонка.
 *
 *   - `starting` — форма открыта, звонок регистрируется/комната поднимается;
 *   - `ringing`  — звонок зарегистрирован, ждём ответа (только инициатор);
 *   - `active`   — собеседник в комнате, идёт разговор.
 *
 * В двух первых состояниях контент перекрывает оверлей с именем собеседника,
 * статусом и кнопкой отмены; в `active` оверлей прячется, остаются
 * раскладка участников и плашка «я».
 */
export const CALL_STATES: readonly CallState[] = ["starting", "ringing", "active"];

/**
 * ***************************************************************************
 * Переводит звонок в новое состояние и обновляет оверлей вызова.
 *
 * Видимость переключается парой `hidden`/`flex`: в собранном Tailwind
 * `.hidden` идёт после `.flex`, поэтому при наличии обоих побеждает
 * `hidden` — одного только снятия `hidden` для показа недостаточно, если
 * рядом остался `flex` от предыдущего состояния.
 * @param form - Экземпляр формы.
 * @param state - Одно из CALL_STATES.
 * @param text - Текст статуса (иначе берётся из локали).
 * @returns {void}
 * ***************************************************************************
 */
export function setState(form: Call, state: CallState, text?: string): void {

    try {

        if (!CALL_STATES.includes(state)) return;
        form.callState = state;

        // ---------- ОВЕРЛЕЙ ----------
        // Оверлей нужен, пока звонок НЕ состоялся: в starting и ringing он
        // показывает аватар, имя собеседника, статус, отсчёт и кнопку отмены.
        // В active он обязан убраться — иначе своим фоном закроет видео и
        // раскладку участников. Раньше условие было перевёрнутым: экран
        // во время прозвона оставался пустым, а в разговоре — закрытым
        const overlay = form?.tpl?.querySelector(":scope >.content [data-call-overlay]");
        const isCallOverlay = state !== "active";

        overlay?.classList.toggle("hidden", !isCallOverlay);
        overlay?.classList.toggle("flex", isCallOverlay);

        // Кольца пульсируют только во время прозвона
        overlay?.classList.toggle("is-ringing", state === "ringing");

        // Плашка «я» показывается, как только в ней есть видео. Завязана
        // на содержимое, а не на состояние: во время прозвона вызывающий
        // видит своё включённое видео поверх оверлея вызова
        syncSelfTileVisibility(form);
        // ---------- ОВЕРЛЕЙ ----------

        // ---------- СТАТУС ----------
        const status = overlay?.querySelector<HTMLElement>(":scope [data-overlay-status]");
        if (status && isCallOverlay) {
            const locale = window._lc.forms.call.status;
            status.textContent = text ?? locale[state] ?? "";
        }

        // Отсчёт «нет ответа» живёт только при прозвоне
        const timer = overlay?.querySelector<HTMLElement>(":scope [data-overlay-timer]");
        if (timer && state !== "ringing") timer.textContent = "";
        // ---------- СТАТУС ----------

    } catch (error) {
        Logger.error("[app][call]: Не удалось переключить состояние звонка", error);
    }

}
