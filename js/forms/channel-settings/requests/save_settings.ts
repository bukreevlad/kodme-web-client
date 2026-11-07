// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса сохранения настроек канала.
 */
export interface ChannelSettingsSaveData {

    /** Id канала. */
    channel_id: string;

    /** Название. */
    name: string;

    /** Описание. */
    about: string;

    /** Публичный/Закрытый. */
    is_public: boolean;

    /** Кто может написать. */
    is_posting: boolean;

    /** Разрешено комментирование. */
    is_commenting: boolean;

}

/**
 * ***************************************************************************
 * Запрос сохранения настроек канала.
 * @param data - Данные запроса.
 * @returns Успешный ответ сервера без полезной нагрузки.
 * @throws Error сервера — разбирает вызывающий код (saveHandler).
 * ***************************************************************************
 */
export async function saveSettingsRequest(data: ChannelSettingsSaveData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[channel]: save settings", data);

}
