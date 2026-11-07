// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { totpStatusRequest } from "../requests/totp_status.js";

// Импортируем functions
import { updateTotpCard } from "./update_totp_card.js";

// Импортируем типы
import type { UserSettingSecurity } from "../index.js";

/**
 * ***************************************************************************
 * Повторная загрузка статуса TOTP и перерисовка карточки (после
 * включения/отключения).
 * @param form - Форма безопасности.
 * ***************************************************************************
 */
export async function refreshTotpStatus(form: UserSettingSecurity): Promise<void> {

    try {

        // Запрос статуса
        const response = await totpStatusRequest();

        // Проверка запроса
        if (response.status) {

            // Перерисовываем карточку TOTP
            updateTotpCard(form, response.data);

        }

    } catch (error) {
        Logger.error(error);

        // Если TOTP запрещён на сервере — прячем карточку целиком
        if (getErrorMessage(error).includes("DISABLED")) {
            form.totpCard?.classList.add("hidden");
            return;
        }

        // Прочая ошибка сервера
        Toast.error(window._lc.api.errors.server_error ?? "Ошибка сервера");
    }

}
