// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { toastError } from "../../../utils/ui/toast_error.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";
import { GroupRemoveModeratorDialog } from "../dialogs/remove/index.js";

// Импортируем requests
import { removeModeratorRequest } from "../requests/remove_moderator.js";

// Импортируем типы
import type { GroupModeratorsManager } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Удаление модератора: диалог подтверждения, запрос и уборка строки
 * из списка. Общий для строки списка и формы настроек модератора.
 * @param form - Форма списка модераторов.
 * @param moderatorId - Id удаляемого модератора.
 * @param onSuccess - Вызывается после успешного удаления (например,
 *   закрыть открытые настройки модератора).
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function removeModeratorHandler(form: GroupModeratorsManager, moderatorId: string, onSuccess?: () => void): Promise<void> {

    try {

        // Диалог подтверждения (подписи берёт сам)
        new GroupRemoveModeratorDialog({
            callback: async (confirmed) => {

                // Отмена — выходим
                if (!confirmed) return;

                try {

                    // Запрос удаления
                    await removeModeratorRequest({ channel_id: form.channelId, user_id: moderatorId });

                    // Убираем строку из списка
                    form.store.remove(moderatorId);

                    // Сообщение
                    Toast.success(t("forms.group_moderators_manager.toasts.success_remove"), { position: "bottom-center" });

                    // Действие после успеха (закрытие настроек и т.п.)
                    onSuccess?.();

                } catch (error) {
                    toastError(error, { context: "[app][group-moderators][remove]" });
                }

            }
        });

    } catch (error) {
        Logger.error(error);
    }

}
