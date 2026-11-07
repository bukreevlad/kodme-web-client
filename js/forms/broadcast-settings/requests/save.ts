// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса сохранения настроек трансляции.
 */
export interface BroadcastSaveSettingsData {

    /** Id трансляции. */
    cast_id: string;

    /** Название. */
    name: string;

    /** Описание. */
    about: string;

    /** Публичная / приватная. */
    is_public: boolean;

    /** Чат трансляции. */
    is_chat: boolean;

}

/**
 * ***************************************************************************
 * Запрос сохранения настроек трансляции.
 * @param data - Данные запроса.
 * @returns Ответ сервера (пустой при успехе).
 * @throws Error сервера — разбирает вызывающий код (saveHandler).
 * ***************************************************************************
 */
export async function saveRequest(data: BroadcastSaveSettingsData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[broadcast]: save settings", data);

}
