// Импортируем utils
import { Logger } from "../../../../../utils/logs/logger.js";

// Импортируем db
import { messagesTable } from "../../../db.js";

// Импортируем типы
import { isRecord } from "../../../types.js";

/**
 * Нагрузка ws-события блокировки участника.
 */
interface ModerationMemberPayload {

    /** Id канала. */
    channel_id: string;

    /** Id участника. */
    user_id: string;

}

/**
 * Значение — нагрузка блокировки/разблокировки участника.
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
 * Применяет событие блокировки участника к локальным хранилищам: состояние
 * бана автора обновляется в локальных сообщениях канала (для показа пункта
 * «Разблокировать»).
 *
 * Самой жертве сервер дополнительно шлёт событие удаления канала
 * (`[channel]: remove`) — канал у неё вычищает applyChannelRemove.
 * @param data - Нагрузка события (id канала и id участника).
 * @returns {void}
 * ***************************************************************************
 */
export async function applyMemberBanned(data: unknown): Promise<void> {
    Logger.debug("[app][feed]::member_banned", data);

    try {

        // Нагрузка сокета типизирована как unknown: работаем только с известной структурой
        if (!isModerationMemberPayload(data)) return;

        // Обновляем состояние бана в локальных сообщениях автора
        await messagesTable()
            .where("channel_id")
            .equals(data.channel_id)
            .and(message => message.author_id === data.user_id)
            .modify({ author_is_blocked: true });

    } catch (error) {
        Logger.error(error);
    }
}
