// Импортируем utils
import { ResponseHandler } from "../../../utils/network/fetch_handler.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса регистрации.
 */
export interface RegistrationRequestData {
    /** Email. */
    email: string;
    /** Имя. */
    first_name: string;
    /** Фамилия. */
    last_name: string;
    /** Пароль. */
    password: string;
    /** Пароль повторно. */
    retry_password: string;
}

/**
 * ***************************************************************************
 * Отправляет запрос регистрации на сервер.
 * @param data - Данные запроса.
 * @returns Ответ сервера в конверте `{ status: true }`.
 * ***************************************************************************
 */
export async function registrationRequest(data: RegistrationRequestData): Promise<Answer> {

    // Запрос на сервер (легаси: try/catch с rethrow удалён — ошибка уходит наружу как есть)
    const request = await fetch(`/api/v1/auth/reg`, {
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
