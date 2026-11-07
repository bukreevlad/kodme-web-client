// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса сохранения настроек группы.
 */
export interface GroupSettingsSaveData {

    /** Id канала. */
    channel_id: string;

    /** Название. */
    name: string;

    /** Описание. */
    about: string;

    /** Публичная/Закрытая. */
    is_public: boolean;

    /** Кто может публиковать. */
    is_posting: boolean;

}

/**
 * ***************************************************************************
 * Запрос сохранения настроек группы.
 * @param data - Данные запроса.
 * @returns Успешный ответ сервера без полезной нагрузки.
 * @throws Error сервера — разбирает вызывающий код (saveHandler).
 * ***************************************************************************
 */
export async function saveSettingsRequest(data: GroupSettingsSaveData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[group]: save settings", data);

}
