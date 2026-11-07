// Импортируем utils
import { ResponseHandler } from "../../../utils/network/fetch_handler.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса второго шага входа по ключу доступа.
 */
export interface PasskeyLoginFinishRequestData {
    /** Идентификатор ceremony из первого шага. */
    ceremony_id: string;
    /** clientDataJSON в base64url. */
    client_data: string;
    /** authenticatorData в base64url. */
    authenticator_data: string;
    /** Подпись assertion в base64url. */
    signature: string;
    /** Идентификатор credential'а (base64url, как возвращает браузер). */
    credential_id: string;
    /** Платформа. */
    platform: string;
    /** User agent. */
    user_agent: string;
}

/**
 * Полезная нагрузка ответа второго шага входа по ключу доступу
 * (форма ответа — как у confirm: клиент переиспользует сохранение сессии).
 */
export interface PasskeyLoginFinishResponse {
    /** Пара токенов. */
    pair_token: { accessToken: string; refreshToken: string };
    /** Аватар пользователя. */
    avatar_host_url: string | null;
    /** Отображаемое имя пользователя. */
    display_name: string;
    /** Email пользователя (null, если не заполнен). */
    email: string | null;
    /** Id подтверждённой сессии. */
    session_id: string;
}

/**
 * ***************************************************************************
 * Отправляет запрос второго шага входа по ключу доступу (проверка assertion).
 * @param data - Данные запроса.
 * @returns Ответ сервера в конверте с парой токенов.
 * ***************************************************************************
 */
export async function passkeyLoginFinishRequest(data: PasskeyLoginFinishRequestData): Promise<Answer<PasskeyLoginFinishResponse>> {

    // Запрос на сервер (ошибка уходит наружу как есть)
    const request = await fetch(`/api/v1/auth/passkey/login/finish`, {
        method: "POST",
        cache: "no-cache",
        headers: new Headers({ "content-type": "application/json" }),
        body: JSON.stringify(data)
    });

    // Получаем ответ
    const response = await ResponseHandler.handle(request);

    // invariant: HTTP API оборачивает успешный ответ в конверт
    return response as Answer<PasskeyLoginFinishResponse>;

}
