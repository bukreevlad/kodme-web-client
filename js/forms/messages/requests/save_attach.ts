// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT_SAVE_ATTACH } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса завершения загрузки вложения.
 */
export interface SaveAttachData {

    /** Id документа, полученный из ответа get upload attach url. */
    document_id: string;

}

/**
 * Ответ сервера на завершение загрузки вложения.
 */
export interface SaveAttachResult {

    /** Id документа. */
    document_id: string;

    /** Статус обработки ("ready" — можно отправлять сообщение). */
    status: string;

    /**
     * false — производные ассеты не созданы: сообщение уйдёт без превью
     * (деградация обработки). Поле опционально — сервер
     * добавляет его только в деградированных ответах.
     */
    processed?: boolean;

    /** Причина деградации: "failed" — конвейер отработал неудачно. */
    reason?: string;

}

/**
 * ***************************************************************************
 * Завершить загрузку вложения: сервер проверяет оригинал в хранилище и
 * генерирует производные (превью, метадату), отвечая «готово».
 *
 * Таймаут — SOCKET_REQUEST_TIMEOUT_SAVE_ATTACH (120 с): ожидание серверной
 * обработки заметно дольше обычных запросов.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (`functions/sending_messages.ts`).
 * @param data - Данные запроса.
 * @returns Id документа и статус обработки.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function saveAttachRequest(data: SaveAttachData): Promise<Answer<SaveAttachResult>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT_SAVE_ATTACH)
        .emitWithAck<SaveAttachResult>("[message]: save attach", data);

}
