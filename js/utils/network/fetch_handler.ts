// Импортируем utils
import { ApiError } from "./api_error.js";

// Импортируем типы
import type { ServerErrorPayload } from "../../types/domain.js";
import { t } from "../i18n/index.js";

/**
 * ***************************************************************************
 * ResponseHandler - централизованная обработка сетевых ответов fetch.
 * Преобразует Response в данные (JSON/Text) или выбрасывает типизированную
 * ApiError со статусом и деталями сервера.
 * ***************************************************************************
 */
export class ResponseHandler {

    /**
     * ***************************************************************************
     * Обрабатывает объект Response, возвращаемый функцией fetch.
     * @param {Response} response - Объект ответа от fetch.
     * @returns {Promise<unknown>} - Данные ответа (JSON/Text) либо null; при
     *   неуспешном статусе отклоняется ApiError.
     * ***************************************************************************
     */
    static async handle(response: Response): Promise<unknown> {

        // Проверка на успешный статус (2xx)
        if (response.ok) {

            // Если статус успешный, пытаемся вернуть данные
            let contentType = response.headers.get("content-type");

            // Парсим тело ответа
            if (contentType && contentType.includes("application/json")) {
                return await response.json();
            } else if (contentType && contentType.includes("text/")) {
                return await response.text();
            }

            // Если контент пустой
            return null;

        }

        // Обработка неуспешного статуса (4xx, 5xx): конверт ошибки сервера
        let errorDetails: ServerErrorPayload = {};

        try {

            // Попытка получить детали ошибки от сервера в формате JSON
            let contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                errorDetails = await response.json();
            } else {
                errorDetails.message = await response.text();
            }

        } catch (e) {
            errorDetails.message = errorDetails.message || t("utils.fetch_handler.body_read_failed");
        }

        // Формируем структурированное сообщение об ошибке
        const errorMessage = errorDetails.message
            ? t("utils.fetch_handler.http_error", { status: response.status, message: errorDetails.message })
            : t("utils.fetch_handler.request_failed", { status: response.status, statusText: response.statusText });

        // Создаем и выбрасываем типизированную ошибку API, включая статус и детали
        throw new ApiError(errorMessage, {
            code: errorDetails.code,
            reason: errorDetails.reason,
            status: response.status,
            details: errorDetails
        });

    }
}
