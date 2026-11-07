// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { removeSessionRequest } from "../requests/remove.js";

// Импортируем dialogs
import { ConfirmDeviceDialog } from "../dialogs/confirm/index.js";

// Импортируем типы
import type { UserSettingDevices } from "../index.js";
import type { SessionListItem } from "../types.js";

/**
 * ***************************************************************************
 * Удаление одной сессии (устройства) через диалог подтверждения.
 * @param form - Экземпляр формы.
 * @param data - Данные удаляемой сессии.
 * ***************************************************************************
 */
export async function removeSessionHandler(form: UserSettingDevices, data: SessionListItem): Promise<void> {

    try {

        // Диалог подтверждения удаления сессии
        let dialogConfirm = new ConfirmDeviceDialog({
            title: window._lc.forms.user_setting_devices.dialogs.remove.title,
            description: window._lc.forms.user_setting_devices.dialogs.remove.description,
            actionClose: window._lc.forms.user_setting_devices.dialogs.remove.action_close,
            actionRemove: window._lc.forms.user_setting_devices.dialogs.remove.action_remove,
            insertInto: form.modal?.content,
            callback: async (response) => {

                try {

                    // Если пользователь отказался — ничего не делаем
                    if (!response) return;

                    // Запрос
                    let result = await removeSessionRequest({
                        session_id: data.id,
                    });

                    // Проверка запроса
                    if (result.status) {

                        // Закрываем диалог
                        dialogConfirm?.modal?.close();

                        // Toast
                        Toast.success(window._lc.forms.user_setting_devices.toasts.success_remove);

                        // Удаляем элемент из Store формы
                        form.store.remove(data.id);

                    }

                } catch (error) {
                    Logger.error(error);

                    // Флаг, что тост уже показан
                    let isToastShown = false;

                    // Если ошибка идентификатора сессии или пользователя
                    if (getErrorMessage(error).includes("SESSION_ID_") || getErrorMessage(error).includes("USER_ID_")) {

                        // Toast
                        Toast.error(window._lc.forms.user_setting_devices.toasts.remove_error);
                        isToastShown = true;
                    }

                    // Прочая ошибка сервера
                    if (!isToastShown) {
                        Toast.error(window._lc.api.errors.server_error ?? "Ошибка сервера");
                    }

                }

            }
        });

    } catch (error) {
        Logger.error(error);
    }

}
