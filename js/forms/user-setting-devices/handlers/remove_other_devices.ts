// Импортируем utils
import { LocalStorage } from "../../../utils/local_storage.js";
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { removeOtherSessionsRequest } from "../requests/remove_other_devices.js";

// Импортируем dialogs
import { ConfirmDeviceDialog } from "../dialogs/confirm/index.js";

// Импортируем типы
import type { UserSettingDevices } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Удаление всех сессий, кроме текущей, через диалог подтверждения.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function removeAllOtherDevicesHandler(form: UserSettingDevices): Promise<void> {

    try {

        // Диалог подтверждения удаления всех других сеансов (подписи берёт сам)
        let dialogConfirm = new ConfirmDeviceDialog({
            scenario: "remove_all",
            insertInto: form.modal?.content,
            callback: async (response) => {

                try {

                    // Если пользователь отказался — ничего не делаем
                    if (!response) return;

                    // Серверу нужен id активного сеанса (чтобы не удалить его):
                    // без него «удалять другие» не по чему
                    const activeSessionId = LocalStorage.sessionId;
                    if (activeSessionId === null) return;

                    // Запрос
                    let result = await removeOtherSessionsRequest({
                        active_session_id: activeSessionId,
                    });

                    // Проверка запроса
                    if (result.status) {

                        // Закрываем диалог
                        dialogConfirm?.modal?.close();

                        // Toast
                        Toast.success(t("forms.user_setting_devices.toasts.success_remove_all_other_devices"));

                        // Закрываем форму
                        form.modal?.close();

                    }

                } catch (error) {
                    Logger.error(error);
                }

            }
        });

    } catch (error) {
        Logger.error(error);
    }

}
