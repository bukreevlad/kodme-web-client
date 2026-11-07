// Импортируем utils
import { ResponseHandler } from "../../../utils/network/fetch_handler.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса подтверждения кода входа.
 */
export interface ConfirmRequestData {
    /** Id сессии. */
    session_id: string;
    /** Код подтверждения. */
    code: string;
}

/**
 * Полезная нагрузка ответа подтверждения кода входа.
 */
export interface ConfirmResponse {
    /** Пара токенов сессии. */
    pair_token: {
        /** Access-токен. */
        accessToken: string;
        /** Refresh-токен. */
        refreshToken: string;
    };
    /** Id документа аватара пользователя. */
    avatar_host_url: string | null;
    /** Отображаемое имя пользователя. */
    display_name: string;
}

/**
 * ***************************************************************************
 * Отправляет запрос подтверждения кода входа.
 * @param data - Данные запроса.
 * @returns Ответ сервера в конверте `{ data: { pair_token, avatar_host_url, display_name }, status: true }`.
 * ***************************************************************************
 */
export async function confirmRequest(data: ConfirmRequestData): Promise<Answer<ConfirmResponse>> {

    // Запрос на сервер (легаси: try/catch с rethrow удалён — ошибка уходит наружу как есть)
    const request = await fetch(`/api/v1/auth/confirm`, {
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
    return response as Answer<ConfirmResponse>;

}
