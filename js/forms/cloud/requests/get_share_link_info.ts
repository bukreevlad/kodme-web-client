// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT_HEAVY } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { CloudSharedItem } from "../types.js";

/**
 * ***************************************************************************
 * Данные запроса информации о ссылке общего доступа.
 ***************************************************************************
 */
export interface GetShareLinkInfoData {

    /** Значение ссылки (токен). */
    link: string;

}

/**
 * Информация о ссылке (читается только элемент — тип определяет сценарий
 * открытия ссылки из сообщения).
 */
export interface ShareLinkInfoResult {

    /** Элемент, на который ведёт ссылка. */
    item: CloudSharedItem;

}

/**
 * ***************************************************************************
 * Получение информации о ссылке общего доступа по её токену.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. functions/open_message_cloud_link.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера информацией о ссылке.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function getShareLinkInfoRequest(data: GetShareLinkInfoData): Promise<Answer<ShareLinkInfoResult>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT_HEAVY)
        .emitWithAck<ShareLinkInfoResult>("[cloud]: get share link info", data);

}
