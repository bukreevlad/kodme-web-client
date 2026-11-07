// Импортируем utils
import { ResponseHandler } from "../../../utils/network/fetch_handler.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Результат сканирования QR-кода (данные сессии подтверждаемого устройства).
 */
export interface ScannedQRData {

    /** Id qr-сессии подтверждаемого устройства. */
    session_id: string;

    /** IP подтверждаемого устройства. */
    ip: string;

    /** User-agent подтверждаемого устройства. */
    user_agent: string;

}

/**
 * Данные запроса отметки QR-кода как отсканированного.
 */
export interface ScannedQRRequestData {

    /** Данные qr-кода (id из распарсенного JSON). */
    qr_data: { id: string };

}

/**
 * ***************************************************************************
 * Отметка QR-кода как отсканированного (устройство навело камеру).
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. functions/handle_scanner.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера результатом сканирования.
 * @throws Ошибка сети/сервера пробрасывается без изменений.
 * ***************************************************************************
 */
export async function scannedRequest(data: ScannedQRRequestData): Promise<Answer<ScannedQRData>> {

    // Запрос на сервер
    const request = await fetch(`/api/v1/auth/login/qrcode/scanned`, {
        method: "POST",
        cache: "no-cache",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data)
    });

    // invariant: успешный ответ сервера — конверт createAnswer с данными
    // сканирования; не-2xx отклоняется ResponseHandler'ом с ApiError
    return await ResponseHandler.handle(request) as Answer<ScannedQRData>;

}
