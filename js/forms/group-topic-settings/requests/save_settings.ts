// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса сохранения настроек темы группы.
 */
export interface GroupTopicSettingsSaveData {

    /** Id канала. */
    channel_id: string;

    /** Название. */
    name: string;

    /** Описание. */
    about: string;

    /** Публичная/Закрытая. */
    visibility: "public" | "private";

    /** Кто может публиковать. */
    posting_mode: "all" | "admins";

}

/**
 * ***************************************************************************
 * Запрос сохранения настроек темы группы.
 * @param data - Данные запроса.
 * @returns Успешный ответ сервера без полезной нагрузки.
 * @throws Error сервера — разбирает вызывающий код (saveHandler).
 * ***************************************************************************
 */
export async function saveSettingsRequest(data: GroupTopicSettingsSaveData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[group-topic]: save settings", data);

}
