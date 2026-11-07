// Импортируем utils
import { ResponseHandler } from "../../../utils/network/fetch_handler.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса отправки кода восстановления.
 */
export interface SendRequestData {
    /** Email пользователя. */
    email: string;
}

/**
 * ***************************************************************************
 * Отправляет запрос отправки кода подтверждения на почту.
 * @param data - Данные запроса.
 * @returns Ответ сервера в конверте `{ status: true }`.
 * ***************************************************************************
 */
export async function sendRequest(data: SendRequestData): Promise<Answer> {

    // Запрос на сервер (легаси: try/catch с rethrow удалён — ошибка уходит наружу как есть)
    const request = await fetch(`/api/v1/auth/forgot-password/send`, {
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
    return response as Answer;

}
