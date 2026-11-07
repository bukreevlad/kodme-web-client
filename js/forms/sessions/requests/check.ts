// Импортируем utils
import { ResponseHandler } from "../../../utils/network/fetch_handler.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса проверки сессии.
 */
export interface CheckRequestData {
    /** Access token. */
    access_token: string;
}

/**
 * Полезная нагрузка ответа проверки сессии.
 */
export interface CheckResponse {
    /** Данные пользователя (попадают в поле user сессии). */
    user_data: unknown;
    /** Серверные настройки (попадают в поле server сессии). */
    server_data: unknown;
}

/**
 * ***************************************************************************
 * Отправляет запрос проверки access-токена на сервер.
 * @param data - Данные запроса.
 * @returns Ответ сервера в конверте `{ data: { user_data, server_data }, status: true }`.
 * ***************************************************************************
 */
export async function checkRequest(data: CheckRequestData): Promise<Answer<CheckResponse>> {

    // Запрос на сервер (легаси: try/catch с rethrow удалён — ошибка уходит наружу как есть)
    const request = await fetch(`/api/v1/auth/check`, {
        method: "POST",
        cache: "no-cache",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${data.access_token}`,
        }
    });

    // Получаем ответ
    const response = await ResponseHandler.handle(request);

    // invariant: HTTP API оборачивает успешный ответ в конверт
    // { data, status: true, timestamp }; ошибки сервера уходят
    // неуспешным статусом, и ResponseHandler бросает их до этой точки
    return response as Answer<CheckResponse>;

}
