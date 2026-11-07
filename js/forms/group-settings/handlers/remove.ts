// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { removeRequest } from "../requests/remove.js";

// Импортируем dialogs
import { RemoveGroup } from "../dialogs/remove/index.js";

// Импортируем forms
import { Messages } from "../../messages/index.js";
import { ChannelProfile } from "../../channel-profile/index.js";

// Импортируем типы
import type { GroupSettings } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Полное удаление группы: открывает диалог подтверждения, выполняет запрос
 * и закрывает связанные формы при успехе.
 * @param form - Форма.
 * ***************************************************************************
 */
export async function removeHandler(form: GroupSettings): Promise<void> {

    try {

        // Открываем диалог подтверждения
        let dialogConfirm = new RemoveGroup({
            channelId: form.channelId,
            callback: async (confirmed) => {
                if (confirmed) {

                    try {

                        // Запрос
                        await removeRequest({ channel_id: form.channelId });

                    } catch (error) {
                        Logger.error(error);

                        // Если нет доступа
                        if (getErrorMessage(error).includes("ACCESS_DENIED")) {

                            // Toast
                            Toast.error(t("forms.group_settings.toasts.access_denied"));

                        } else {

                            // Прочая ошибка сервера
                            Toast.error(t("api.errors.server_error"));

                        }

                        return;
                    }

                    // Toast
                    Toast.success(t("forms.group_settings.toasts.success_remove"));

                    // Закрываем модальное окно
                    dialogConfirm?.modal?.close();

                    // Закрываем форму
                    form.modal?.close();

                    // Поиск формы сообщений
                    let messagesForm = Messages.instances.get(form.channelId);
                    if (messagesForm) {
                        messagesForm?.modal?.close();
                    }

                    // Поиск формы профиля канала
                    let channelProfileForm = ChannelProfile.instances.get(form.channelId);
                    if (channelProfileForm) {
                        channelProfileForm?.modal?.close();
                    }

                }
            }
        });

    } catch (error) {
        Logger.error(error);
    }

}
