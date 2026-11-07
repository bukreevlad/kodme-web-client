// Импортируем utils
import { ResponseHandler } from "../../../utils/network/fetch_handler.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { QRCodeStatusResponse } from "../types.js";

/**
 * Данные запроса опроса статуса QR-кода.
 */
export interface GetQRCodeStatusRequestData {

    /** Id QR-кода. */
    qr_id: string;

}

/**
 * ***************************************************************************
 * Запрос опроса статуса QR-кода авторизации.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. functions/get_qr_status_polling.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера: статус QR-сессии в конверте.
 * @throws Ошибка сети/сервера пробрасывается без изменений.
 * ***************************************************************************
 */
export async function getQRCodeStatusRequest(data: GetQRCodeStatusRequestData): Promise<Answer<QRCodeStatusResponse>> {

    // Запрос на сервер
    const request = await fetch(`/api/v1/auth/login/qrcode/polling`, {
        method: "POST",
        cache: "no-cache",
        headers: new Headers({ "content-type": "application/json" }),
        body: JSON.stringify(data)
    });

    // Получаем ответ
    const response = await ResponseHandler.handle(request);

    // invariant: HTTP API оборачивает успешный ответ в конверт
    // { data, status: true, timestamp }; ошибки сервера уходят
    // неуспешным статусом, и ResponseHandler бросает их до этой точки
    return response as Answer<QRCodeStatusResponse>;

}
