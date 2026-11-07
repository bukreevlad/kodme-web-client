/**
 * Статус QR-сессии авторизации в успешном ответе поллинга.
 * Истёкшая или потерянная сессия приходит ошибкой 400 (EXPIRED /
 * SESSION_NOT_FOUND), а не статусом — см. get_qr_status_polling.ts.
 */
export type QRCodeStatus = "PENDING" | "SCANNED" | "COMPLETED";

/**
 * Полезная нагрузка ответа опроса статуса QR-кода.
 * Поля авторизации заполняются только при статусе "COMPLETED".
 */
export interface QRCodeStatusResponse {

    /** Статус QR-сессии. */
    status: QRCodeStatus;

    /** Id пользователя (только для "COMPLETED"). */
    user_id?: string;

    /** Отображаемое имя пользователя (только для "COMPLETED"). */
    display_name?: string;

    /** Email пользователя (только для "COMPLETED"). */
    email?: string;

    /** Id сессии (только для "COMPLETED"). */
    session_id?: string;

    /** Access-токен (только для "COMPLETED"). */
    access_token?: string;

    /** Refresh-токен (только для "COMPLETED"). */
    refresh_token?: string;

}

/**
 * Полезная нагрузка ответа генерации QR-кода авторизации.
 */
export interface QRCodeAuthSession {

    /** Id QR-кода (по нему опрашивается статус). */
    qr_id: string;

    /** QR-код в формате data URL. */
    qr_image: string;

}

/**
 * Опции поллинга статуса QR-кода.
 */
export interface QRCodePollingOptions {

    /** Интервал между запросами (мс). */
    interval?: number;

    /** Максимальное количество попыток. */
    maxAttempts?: number;

    /** Коллбек при каждом запросе. */
    onProgress?: ((response: QRCodeStatusResponse, attempts: number) => void) | null;

}
