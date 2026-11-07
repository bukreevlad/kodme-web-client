// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { SubscribeAnswerData } from "./subscribe.js";

/**
 * Данные запроса отписки от пака стикеров («убрать из добавленных»).
 */
export interface UnsubscribeRequestData {

    /** Id пака. */
    pak_id: string;

}

/**
 * ***************************************************************************
 * Запрос отписки от пака стикеров.
 *
 * Пак остаётся в каталоге (если публичный) — пропадает только пометка
 * «добавлен». Модуль запроса только отправляет запрос и пробрасывает
 * ошибку наружу: разбирает её вызывающий код (см. handlers/context_menu.ts).
 * @param data - Данные запроса.
 * @returns Ответ с флагом is_member.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function unsubscribeRequest(data: UnsubscribeRequestData): Promise<Answer<SubscribeAnswerData>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<SubscribeAnswerData>("[sticker]: unsubscribe", data);

}
