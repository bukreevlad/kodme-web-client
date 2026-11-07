// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { removeRequest } from "../requests/remove.js";

// Импортируем dialogs
import { RemoveCast } from "../dialogs/remove/index.js";

// Импортируем forms
import { BroadcastPlay } from "../../broadcast-play/index.js";
import { Broadcasts } from "../../broadcasts/index.js";

// Импортируем типы
import type { BroadcastSettings } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Полное удаление трансляции: открывает диалог подтверждения, выполняет
 * запрос и закрывает связанные формы при успехе.
 * @param form - Форма.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function removeHandler(form: BroadcastSettings): Promise<void> {

    try {

        // Открываем диалог подтверждения
        let dialogConfirm = new RemoveCast({
            castId: form.castId,
            callback: async (confirmed) => {
                if (confirmed) {

                    try {

                        // Запрос
                        await removeRequest({ cast_id: form.castId });

                    } catch (error) {
                        Logger.error(error);

                        // Если нет доступа
                        if (getErrorMessage(error).includes("ACCESS_DENIED")) {

                            // Toast
                            Toast.error(t("forms.broadcast_settings.toasts.access_denied"));

                        } else {

                            // Прочая ошибка сервера
                            Toast.error(t("api.errors.server_error"));

                        }

                        return;
                    }

                    // Toast
                    Toast.success(t("forms.broadcast_settings.toasts.success_remove"));

                    // Закрываем модальное окно
                    dialogConfirm?.modal?.close();

                    // Закрываем форму
                    form.modal?.close();

                    // Поиск формы проигрывания
                    let broadcastPlayForm = BroadcastPlay.instances.get(form.castId);
                    if (broadcastPlayForm) {
                        broadcastPlayForm?.modal?.close();
                    }

                    // Поиск формы списка трансляций
                    let broadcastsForm = Broadcasts.instance;
                    if (broadcastsForm) {
                        broadcastsForm?.store?.remove(form.castId);
                    }

                }
            }
        });

    } catch (error) {
        Logger.error(error);
    }

}
