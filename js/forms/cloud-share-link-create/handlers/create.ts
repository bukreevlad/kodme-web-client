// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем handlers формы
import { createShareLinkHandler } from "../../cloud/handlers/create_share_link.js";

// Импортируем типы
import type { CloudAccessLevel } from "../../cloud/types.js";
import type { CreateShareLink } from "../index.js";

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
            expiresAt = new Date(expiresInput.value).toISOString();
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
            Toast.success(window._lc.forms.cloud.toasts.link_created);

        }

    } catch (error) {
        Logger.error(error);
    }

}
