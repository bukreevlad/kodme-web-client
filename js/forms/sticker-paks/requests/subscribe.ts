// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса подписки на пак стикеров («добавить к себе»).
 */
export interface SubscribeRequestData {

    /** Id пака. */
    pak_id: string;

}

/**
 * Данные ответа подписки/отписки на пак.
 */
export interface SubscribeAnswerData {

    /** Id пака. */
    pak_id: string;

    /** Флаг подписки после операции. */
    is_member: boolean;

}

/**
 * ***************************************************************************
 * Запрос подписки на пак стикеров (публичный пак появляется «в своих»).
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/context_menu.ts).
 * @param data - Данные запроса.
 * @returns Ответ с флагом is_member.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function subscribeRequest(data: SubscribeRequestData): Promise<Answer<SubscribeAnswerData>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<SubscribeAnswerData>("[sticker]: subscribe", data);

}
