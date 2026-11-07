// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage, getErrorStatus } from "../../../utils/helpers/error_util.js";

// Импортируем requests
import { getQRCodeStatusRequest } from "../requests/get_qr_status.js";

// Импортируем functions
import { getQRCode } from "./get_qrcode.js";

// Импортируем типы
import type { LoginWithQRCode } from "../index.js";
import type { QRCodePollingOptions, QRCodeStatusResponse } from "../types.js";

/**
 * ***************************************************************************
 * Опрашивает статус QR-кода до подтверждения входа или истечения попыток.
 *
 * При истёкшей/потерянной QR-сессии сервер отвечает ошибкой 400 — тогда
 * запрашивается новый QR-код и поллинг продолжается. Превышение лимита
 * запросов (429) поллинг не прерывает.
 * @param form - Экземпляр формы.
 * @param options - Опции поллинга.
 * @returns Ответ сервера при подтверждённом входе.
 * ***************************************************************************
 */
export function getQRCodeStatusPolling(form: LoginWithQRCode, options: QRCodePollingOptions = {}): Promise<QRCodeStatusResponse> {

    // Без id QR-кода опрашивать нечего: вызывающий (`_setup` формы)
    // ловит эту ошибку и пишет её в лог
    if (!form.qrId) throw new Error("[app][login-with-qrcode]: Не получен id QR-кода, поллинг не запущен");

    // Устанавливаем параметры
    const {
        interval = 3000,
        maxAttempts = 300,
        onProgress = null
    } = options;

    // Кол. попыток
    let attempts = 0;

    // Создаем промис для асинхронного ожидания результата
    return new Promise((resolve, reject) => {

        // Просто сохраняем ID интервала в форме
        form.pollingInterval = setInterval(async () => {

            // Прибавляем попытки
            attempts++;

            try {
                // id QR-кода читаем каждый тик: после ошибки 400 он
                // перегенерируется (см. getQRCode ниже), без него —
                // останавливаем опрос
                const qrId = form.qrId;
                if (!qrId) {
                    Logger.warn("[app][login-with-qrcode]: Нет id QR-кода, поллинг остановлен");
                    if (form.pollingInterval !== null) clearInterval(form.pollingInterval);
                    return;
                }

                // Делаем запрос на сервер
                const response = await getQRCodeStatusRequest({ qr_id: qrId });

                // Если есть данные
                if (response.status && response.data) {

                    // Вызываем коллбек прогресса если он есть
                    if (onProgress && typeof onProgress === "function") {
                        onProgress(response.data, attempts);
                    }

                    // Отправляем данные
                    resolve(response.data);
                    return;

                }

                // Если достигли максимального количества попыток
                if (attempts >= maxAttempts) {
                    if (form.pollingInterval !== null) clearInterval(form.pollingInterval);
                    reject(new Error(`Достигнуто максимальное количество попыток (${maxAttempts})`));
                    return;
                }

            } catch (error) {

                // Если сессия истекла
                if (getErrorMessage(error).includes("Ошибка 400: EXPIRED")) {
                    await getQRCode(form);
                    return;
                }

                // Если сессия не найдена
                if (getErrorMessage(error).includes("Ошибка 400: SESSION_NOT_FOUND")) {
                    await getQRCode(form);
                    return;
                }

                // Если превышен лимит запросов — продолжаем поллинг дальше
                if (getErrorMessage(error).includes("RATE_LIMIT_EXCEEDED") || getErrorStatus(error) === 429) {
                    Logger.warn("[app][login-with-qrcode]: Превышен лимит опроса QR-статуса, ждём следующий интервал");
                    return;
                }

                // Сбрасываем интервал
                Logger.error(error);
                if (form.pollingInterval !== null) clearInterval(form.pollingInterval);
                reject(error);

            }

        }, interval);

    });

}
