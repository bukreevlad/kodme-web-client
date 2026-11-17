// Импортируем utils
import { Logger } from "../../../../../utils/logs/logger.js";

// Импортируем db
import { messagesTable } from "../../../db.js";

// Импортируем типы
import { isRecord } from "../../../types.js";

/**
 * Нагрузка ws-события разблокировки участника.
 */
interface ModerationMemberPayload {

    /** Id канала. */
    channel_id: string;

    /** Id участника. */
    user_id: string;

}

/**
 * Значение — нагрузка разблокировки участника.
 * @param value - Проверяемое значение.
 * @returns true, если значение похоже на нагрузку.
 */
function isModerationMemberPayload(value: unknown): value is ModerationMemberPayload {

    return isRecord(value)
        && typeof value.channel_id === "string"
        && typeof value.user_id === "string";

}

/**
 * ***************************************************************************
 * Применяет событие разблокировки участника к локальным хранилищам: состояние
 * бана автора снимается в локальных сообщениях канала (для показа пункта
 * «Забанить»).
 * @param data - Нагрузка события (id канала и id участника).
 * @returns {void}
 * ***************************************************************************
 */
export async function applyMemberUnbanned(data: unknown): Promise<void> {
    Logger.debug("[app][feed]::member_unbanned", data);

    try {

        // Нагрузка сокета типизирована как unknown: работаем только с известной структурой
        if (!isModerationMemberPayload(data)) return;

        // Снимаем пометку бана в локальных сообщениях автора
        await messagesTable()
            .where("channel_id")
            .equals(data.channel_id)
            .and(message => message.author_id === data.user_id)
            .modify({ author_is_blocked: false });

    } catch (error) {
        Logger.error(error);
    }
}
