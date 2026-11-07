// Импортируем типы
import type { ServerErrorPayload } from "../../types/domain.js";

/**
 * ***************************************************************************
 * ApiError - типизированная ошибка API.
 *
 * Легаси-код клал поля серверной ошибки (code/reason/status/details) прямо
 * в экземпляр `Error` — потребители читали `error.code` и `error.status`
 * без всякой типизации. Класс делает эти поля явными: приёмная сторона
 * (разбор ошибок, показ тостов) читает их честно, а не «на веру».
 *
 * Форма полей повторяет ServerErrorPayload (конверт ошибки сервера).
 * ***************************************************************************
 */
export class ApiError extends Error {

    /** Код ошибки, например "ACCESS_DENIED", "UPLOAD_FAILED". */
    code?: string | undefined;

    /** Техническая причина отказа (например, "RATE_LIMIT_EXCEEDED"). */
    reason?: string | undefined;

    /** HTTP/WS-статус, с которым пришла ошибка (429 и т.п.). */
    status?: number | undefined;

    /** Дополнительные данные сервера (тело ответа и т.п.). */
    details?: unknown;

    /**
     * ***************************************************************************
     * Создаёт ошибку API с полями серверного конверта.
     * @param message - Человекочитаемое сообщение ошибки.
     * @param payload - Поля серверной ошибки (code/reason/status/details).
     * ***************************************************************************
     */
    constructor(message: string, payload: Omit<ServerErrorPayload, "message"> = {}) {
        super(message);

        this.name = "ApiError";
        this.code = payload.code;
        this.reason = payload.reason;
        this.status = payload.status;
        this.details = payload.details;
    }

}
