// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса сохранения настроек конференции.
 */
export interface MeetSaveSettingsData {

    /** Id конференции. */
    meet_id: string;

    /** Название. */
    name: string;

    /** Описание. */
    about: string;

    /** Публичная / приватная. */
    is_public: boolean;

    /** Чат конференции. */
    is_chat: boolean;

}

/**
 * ***************************************************************************
 * Запрос сохранения настроек конференции.
 * @param data - Данные запроса.
 * @returns Ответ сервера (пустой при успехе).
 * @throws Error сервера — разбирает вызывающий код (saveHandler).
 * ***************************************************************************
 */
export async function saveRequest(data: MeetSaveSettingsData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[meet]: save settings", data);

}
