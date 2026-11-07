// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { LocalStorage } from "../../../utils/local_storage.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем forms
import { Sessions } from "../../sessions/index.js";

// Импортируем типы
import type { LoginWithQRCode } from "../index.js";
import type { QRCodeStatusResponse } from "../types.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Обработка ответа поллинга статуса QR-кода: перегенерация QR-кода при
 * ошибке сессии либо завершение авторизации.
 * @param form - Форма.
 * @param response - Ответ сервера.
 * ***************************************************************************
 */
export async function qrCodePollingHandler(form: LoginWithQRCode, response: QRCodeStatusResponse): Promise<void> {

    try {

        // NOTE: ветки SESSION_NOT_FOUND/EXPIRED удалены при миграции: сервер
        // возвращает статусы PENDING/SCANNED/COMPLETED, а истёкшая или
        // потерянная сессия приходит ошибкой 400 — её перегенерация QR-кода
        // обрабатывается в поллинге (см. functions/get_qr_status_polling.ts)

        // Если авторизация завершена
        if (response.status === "COMPLETED") {

            const { session_id, access_token, refresh_token } = response;

            // Без данных сессии сохранять нечего: раньше сюда уходил
            // undefined, и в localStorage попадала нерабочая сессия
            if (!session_id || !access_token || !refresh_token) return;

            // Сохраняем сессию
            LocalStorage.saveSession({
                user: {
                    display_name: response.display_name,
                    email: response.email,
                    id: response.user_id
                },
                session_id,
                access_token,
                refresh_token
            });

            // Делаем ее последней активной
            LocalStorage.setLastActionSession(session_id);

            // Закрываем форму Login
            form.modal?.close();

            // Toast успеха: авторизация завершена
            Toast.success(t("forms.login_with_qrcode.toasts.success_login"));

            // Открываем форму sessions
            new Sessions();

        }

    } catch (error) {
        Logger.error(error);

        // Toast: общая ошибка сервера
        Toast.error(t("api.errors.server_error"));

    }

}
