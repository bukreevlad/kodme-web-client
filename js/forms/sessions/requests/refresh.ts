// Импортируем utils
import { ResponseHandler } from "../../../utils/network/fetch_handler.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса обновления токенов.
 */
export interface RefreshRequestData {
    /** Refresh token. */
    refresh_token: string;
}

/**
 * Полезная нагрузка ответа обновления токенов.
 */
export interface RefreshResponse {
    /** Новый access-токен. */
    access_token: string;
}

/**
 * ***************************************************************************
 * Отправляет запрос обновления access-токена на сервер.
 * @param data - Данные запроса.
 * @returns Ответ сервера в конверте `{ data: { access_token }, status: true }`.
 * ***************************************************************************
 */
export async function refreshRequest(data: RefreshRequestData): Promise<Answer<RefreshResponse>> {

    // Запрос на сервер (легаси: try/catch с rethrow удалён — ошибка уходит наружу как есть)
    const request = await fetch(`/api/v1/auth/refresh`, {
        method: "POST",
        cache: "no-cache",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${data.refresh_token}`
        }
    });

    // Получаем ответ
    const response = await ResponseHandler.handle(request);

    // invariant: HTTP API оборачивает успешный ответ в конверт
    // { data, status: true, timestamp }; ошибки сервера уходят
    // неуспешным статусом, и ResponseHandler бросает их до этой точки
    return response as Answer<RefreshResponse>;

}
