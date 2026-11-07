// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { removeRequest } from "../requests/remove.js";

// Импортируем dialogs
import { RemoveMeet } from "../dialogs/remove/index.js";

// Импортируем forms
import { MeetPlay } from "../../meet-play/index.js";
import { Meets } from "../../meets/index.js";

// Импортируем типы
import type { MeetSettings } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Полное удаление конференции: открывает диалог подтверждения, выполняет
 * запрос и закрывает связанные формы при успехе.
 * @param form - Форма.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function removeHandler(form: MeetSettings): Promise<void> {

    try {

        // Открываем диалог подтверждения
        let dialogConfirm = new RemoveMeet({
            meetId: form.meetId,
            callback: async (confirmed) => {
                if (confirmed) {

                    try {

                        // Запрос
                        await removeRequest({ meet_id: form.meetId });

                    } catch (error) {
                        Logger.error(error);

                        // Если нет доступа
                        if (getErrorMessage(error).includes("ACCESS_DENIED")) {

                            // Toast
                            Toast.error(t("forms.meet_settings.toasts.access_denied"));

                        } else {

                            // Прочая ошибка сервера
                            Toast.error(t("api.errors.server_error"));

                        }

                        return;
                    }

                    // Toast
                    Toast.success(t("forms.meet_settings.toasts.success_remove"));

                    // Закрываем модальное окно
                    dialogConfirm?.modal?.close();

                    // Закрываем форму
                    form.modal?.close();

                    // Поиск формы проигрывания
                    let meetPlayForm = MeetPlay.instances.get(form.meetId);
                    if (meetPlayForm) {
                        meetPlayForm?.modal?.close();
                    }

                    // Поиск формы списка конференций
                    let meetsForm = Meets.instance;
                    if (meetsForm) {
                        meetsForm?.store?.remove(form.meetId);
                    }

                }
            }
        });

    } catch (error) {
        Logger.error(error);
    }

}
