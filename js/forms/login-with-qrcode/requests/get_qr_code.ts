// Импортируем utils
import { ResponseHandler } from "../../../utils/network/fetch_handler.js";
import { PlatformBridge } from "../../../utils/platform.bridge.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { QRCodeAuthSession } from "../types.js";

/**
 * ***************************************************************************
 * Запрос генерации QR-кода авторизации.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. functions/get_qrcode.ts).
 * @returns Ответ сервера: QR-код (data URL) и его id в конверте.
 * @throws Ошибка сети/сервера пробрасывается без изменений.
 * ***************************************************************************
 */
export async function getLoginQRCodeRequest(): Promise<Answer<QRCodeAuthSession>> {

    // Запрос на сервер (платформа нужна серверу, чтобы подтвердить
    // вход в сессию браузера, показывающего QR)
    const request = await fetch(`/api/v1/auth/login/qrcode/gen-auth-session`, {
        method: "POST",
        cache: "no-cache",
        headers: new Headers({ "content-type": "application/json" }),
        body: JSON.stringify({ platform: PlatformBridge.platform })
    });

    // Получаем ответ
    const response = await ResponseHandler.handle(request);

    // invariant: HTTP API оборачивает успешный ответ в конверт
    // { data, status: true, timestamp }; ошибки сервера уходят
    // неуспешным статусом, и ResponseHandler бросает их до этой точки
    return response as Answer<QRCodeAuthSession>;

}
