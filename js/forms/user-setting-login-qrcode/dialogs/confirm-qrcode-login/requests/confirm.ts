// Импортируем utils
import { ResponseHandler } from "../../../../../utils/network/fetch_handler.js";

// Импортируем типы
import type { Answer } from "../../../../../types/domain.js";

/**
 * Данные запроса подтверждения входа по QR-коду.
 */
export interface ConfirmQrcodeLoginData {

    /** Id qr-сессии подтверждаемого устройства. */
    qr_session_id: string;

    /** Refresh token подтверждающего пользователя (в заголовке Authorization). */
    refresh_token: string;

}

/**
 * ***************************************************************************
 * Подтверждение входа по QR-коду.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/confirm.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера без полезной нагрузки.
 * @throws Ошибка сети/сервера (включая RATE_LIMIT_EXCEEDED) пробрасывается
 *         без изменений.
 * ***************************************************************************
 */
export async function confirmQrcodeLoginRequest(data: ConfirmQrcodeLoginData): Promise<Answer> {

    // invariant: userAgentData — нестандартное расширение Navigator (User-Agent
    // Client Hints), отсутствует в стандартных типах DOM-либы; читаем через
    // узкое сужение, значение на runtime остаётся прежним
    const userAgentData = (navigator as Navigator & { userAgentData?: unknown }).userAgentData;

    // Запрос на сервер
    const request = await fetch(`/api/v1/auth/login/qrcode/confirm`, {
        method: "POST",
        cache: "no-cache",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${data.refresh_token}`,
            "x-user-agent": JSON.stringify(userAgentData)
        },
        body: JSON.stringify({
            qr_session_id: data.qr_session_id
        })
    });

    // invariant: успешный ответ сервера — конверт createAnswer без данных;
    // не-2xx отклоняется ResponseHandler'ом с ApiError
    return await ResponseHandler.handle(request) as Answer;

}
