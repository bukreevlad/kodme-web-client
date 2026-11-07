// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

/**
 * ***************************************************************************
 * Префикс ключа в sessionStorage для закреплённого участника.
 *
 * Ключ содержит id конференции: закреплённый — это «в этой встрече я
 * смотрю на вот этого», и переносить выбор из прошлой встречи в новую
 * нельзя. sessionStorage, как и у личного режима сетки (см.
 * LOCAL_LAYOUT_KEY), переживает перезаход в конференцию, но не
 * закрытие вкладки.
 */
const PINNED_PREFIX = "meet_play_pinned:";

/**
 * ***************************************************************************
 * Читает закреплённого участника из sessionStorage.
 *
 * Возвращаем только строку. То, что участника с таким identity больше
 * нет в комнате, проверять здесь нечем и незачем: findFocusIdentity
 * сверяется с реально отрисованными плитками и молча уходит на первую,
 * а participantDisconnected снимает закрепление при уходе.
 * @param meetId - Id конференции.
 * @returns Identity закреплённого или null.
 * ***************************************************************************
 */
export function loadPinned(meetId?: string | null): string | null {

    try {

        if (!meetId) return null;

        const value = sessionStorage.getItem(PINNED_PREFIX + meetId);

        return typeof value === "string" && value ? value : null;

    } catch (error) {
        Logger.warn("[meet-play][pin]: Не удалось прочитать закрепление:", error);
        return null;
    }

}

/**
 * ***************************************************************************
 * Сохраняет закреплённого участника в sessionStorage.
 * @param meetId - Id конференции.
 * @param identity - Identity участника или null (сброс).
 * @returns void
 * ***************************************************************************
 */
export function savePinned(meetId?: string | null, identity?: string | null): void {

    try {

        if (!meetId) return;

        if (!identity) {
            sessionStorage.removeItem(PINNED_PREFIX + meetId);
            return;
        }

        sessionStorage.setItem(PINNED_PREFIX + meetId, identity);

    } catch (error) {
        Logger.warn("[meet-play][pin]: Не удалось сохранить закрепление:", error);
    }

}
