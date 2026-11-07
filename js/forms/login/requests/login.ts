// Импортируем utils
import { ResponseHandler } from "../../../utils/network/fetch_handler.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса авторизации.
 */
export interface LoginRequestData {
    /** Email. */
    email: string;
    /** Пароль. */
    password: string;
    /** Платформа. */
    platform: string;
    /** User agent. */
    user_agent: string;
}

/**
 * Полезная нагрузка ответа авторизации.
 */
export interface LoginResponse {
    /** Id подтверждённой сессии. */
    session_id: string;
    /** Пользователю требуется TOTP-код (вместо кода из письма). */
    totp_required?: boolean | undefined;
}

/**
 * ***************************************************************************
 * Отправляет запрос авторизации на сервер.
 * @param data - Данные запроса.
 * @returns Ответ сервера в конверте `{ data: { session_id }, status: true }`.
 * ***************************************************************************
 */
export async function loginRequest(data: LoginRequestData): Promise<Answer<LoginResponse>> {

    // Запрос на сервер (легаси: try/catch с rethrow удалён — ошибка уходит наружу как есть)
    const request = await fetch(`/api/v1/auth/login`, {
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
    return response as Answer<LoginResponse>;

}
