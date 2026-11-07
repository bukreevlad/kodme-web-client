// Импортируем utils
import { ResponseHandler } from "../../../utils/network/fetch_handler.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { WebauthnRequestOptionsJson } from "../../../utils/helpers/webauthn.js";

/**
 * Данные запроса первого шага входа по ключу доступа.
 */
export interface PasskeyLoginBeginRequestData {
    /** Email (необязательная пре-проверка наличия ключей). */
    email?: string | undefined;
}

/**
 * Полезная нагрузка ответа первого шага входа по ключу доступа.
 */
export interface PasskeyLoginBeginResponse {
    /** Идентификатор ceremony. */
    ceremony_id: string;
    /** Опции для navigator.credentials.get. */
    options: WebauthnRequestOptionsJson;
}

/**
 * ***************************************************************************
 * Отправляет запрос первого шага входа по ключу доступа (challenge).
 * @param data - Данные запроса.
 * @returns Ответ сервера в конверте `{ data: { ceremony_id, options }, status: true }`.
 * ***************************************************************************
 */
export async function passkeyLoginBeginRequest(data: PasskeyLoginBeginRequestData): Promise<Answer<PasskeyLoginBeginResponse>> {

    // Запрос на сервер (ошибка уходит наружу как есть)
    const request = await fetch(`/api/v1/auth/passkey/login/begin`, {
        method: "POST",
        cache: "no-cache",
        headers: new Headers({ "content-type": "application/json" }),
        body: JSON.stringify(data)
    });

    // Получаем ответ
    const response = await ResponseHandler.handle(request);

    // invariant: HTTP API оборачивает успешный ответ в конверт
    return response as Answer<PasskeyLoginBeginResponse>;

}
