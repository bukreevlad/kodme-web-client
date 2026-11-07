// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT_HEAVY } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { CloudShareLinkRow } from "../types.js";

/**
 * ***************************************************************************
 * Данные запроса списка ссылок элемента.
 ***************************************************************************
 */
export interface GetShareLinksData {

    /** Id папки или файла (ссылки на этот элемент). */
    item_id: string;

}

/**
 * ***************************************************************************
 * Получение списка созданных пользователем ссылок на элемент.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. dialogs/share_links/index.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера списком ссылок.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function getShareLinksRequest(data: GetShareLinksData): Promise<Answer<CloudShareLinkRow[]>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT_HEAVY)
        .emitWithAck<CloudShareLinkRow[]>("[cloud]: get share links", data);

}
