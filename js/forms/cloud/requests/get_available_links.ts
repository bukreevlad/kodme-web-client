// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT_HEAVY } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { CloudAvailableLink } from "../types.js";

/**
 * ***************************************************************************
 * Данные запроса списка «Доступное для меня».
 ***************************************************************************
 */
export interface GetAvailableLinksData {

    // Запрос не требует параметров: список строится по id пользователя

}

/**
 * ***************************************************************************
 * Получение списка «Доступное для меня» — ссылок, открытых и сохранённых
 * пользователем.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. functions/get_available_links.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера списком доступных ссылок.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function getAvailableLinksRequest(data: GetAvailableLinksData): Promise<Answer<CloudAvailableLink[]>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT_HEAVY)
        .emitWithAck<CloudAvailableLink[]>("[cloud]: get available links", data);

}
