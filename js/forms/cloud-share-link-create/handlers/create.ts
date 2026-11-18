// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем handlers формы
import { createShareLinkHandler } from "../../cloud/handlers/create_share_link.js";

// Импортируем типы
import type { CloudAccessLevel } from "../../cloud/types.js";
import type { CreateShareLink } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Создание ссылки-приглашения на папку или файл по данным формы диалога.
 * @param dialog - Экземпляр диалога создания ссылки.
 * ***************************************************************************
 */
export async function createHandler(dialog: CreateShareLink): Promise<void> {

    try {

        // ---------- Сбор значений формы ----------

        // Уровень доступа (read / write)
        let access: CloudAccessLevel = "read";
        let readInput = dialog.tpl?.querySelector<HTMLInputElement>(":scope input[name='access_level'][value='read']");
        let writeInput = dialog.tpl?.querySelector<HTMLInputElement>(":scope input[name='access_level'][value='write']");
        if (writeInput?.checked) {
            access = "write";
        } else if (readInput?.checked) {
            access = "read";
        }

        // Срок действия (пусто — без ограничений)
        let expiresAt: string | null = null;
        let expiresInput = dialog.tpl?.querySelector<HTMLInputElement>(":scope input[name='expires_at']");
        if (expiresInput?.value) {
            let expiresDate = new Date(expiresInput.value);

            // Дата должна разбираться и быть в будущем — иначе сервер откажет
            if (Number.isNaN(expiresDate.getTime()) || expiresDate.getTime() <= Date.now()) {
                expiresInput.classList.add("invalid");
                expiresInput.focus();
                Toast.error(t("forms.cloud.toasts.invalid_expires"));
                return;
            }

            expiresAt = expiresDate.toISOString();
        }

        // ---------- Запрос на создание ссылки ----------
        let response = await createShareLinkHandler(dialog.item, {
            user_ids: [],
            access_level: access,
            expires_at: expiresAt
        });

        // Если ссылка создана
        if (response?.status && response.data) {

            // Показываем созданную ссылку в диалоге
            dialog._showResult(response.data);

            // Показываем уведомление
            Toast.success(t("forms.cloud.toasts.link_created"));

        }

    } catch (error) {
        Logger.error(error);

        // Флаг, что тост уже показан
        let isToastShown = false;
        let message = getErrorMessage(error);

        // Срок действия не прошёл проверку сервера (дата в прошлом)
        if (message.includes("EXPIRES_AT_INVALID")) {
            Toast.error(t("forms.cloud.toasts.invalid_expires"));
            isToastShown = true;
        }

        // Элемент удалён/не найден к моменту создания ссылки
        if (message.includes("ITEM_NOT_FOUND")) {
            Toast.error(t("forms.cloud.toasts.element_not_found"));
            isToastShown = true;
        }

        // Нет прав на общий доступ
        if (message.includes("ACCESS_DENIED")) {
            Toast.error(t("forms.cloud.toasts.access_denied"));
            isToastShown = true;
        }

        // Прочая ошибка сервера
        if (!isToastShown) {
            Toast.error(t("api.errors.server_error"));
        }
    }

}
