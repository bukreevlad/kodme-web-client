// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * ***************************************************************************
 * Данные запроса сохранения темы оформления.
 ***************************************************************************
 */
export interface SaveThemeData {

    /** Id темы. */
    theme_id: string;

    /** Название темы. */
    name: string;

    /** CSS-стили темы. */
    style: string;

    /** Публичная ли тема. */
    is_public: boolean;

}

/**
 * ***************************************************************************
 * Сохранение темы оформления.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/save.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера без полезной нагрузки.
 * @throws Ошибка сокета/таймаута (включая коды NAME_REQUIRED, NAME_INVALID,
 *         STYLE_REQUIRED, STYLE_INVALID) пробрасывается без изменений.
 ***************************************************************************
 */
export async function saveThemeRequest(data: SaveThemeData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[theme]: save", data);

}
