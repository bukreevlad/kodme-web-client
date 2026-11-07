// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса удаления пака стикеров.
 */
export interface DeletePakRequestData {

    /** Id пака. */
    pak_id: string;

}

/**
 * ***************************************************************************
 * Запрос удаления пака стикеров (сервер скрывает пак — мягкое удаление).
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/context_menu.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера в конверте.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function deletePakRequest(data: DeletePakRequestData): Promise<Answer> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<undefined>("[sticker]: delete pak", data);

}
