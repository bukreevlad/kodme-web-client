// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage, getErrorStatus } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { passkeyRenameRequest } from "../requests/passkey_rename.js";

// Импортируем dialogs
import { PasskeyRenameDialog } from "../../user-passkey-rename/index.js";

// Импортируем типы
import type { UserSettingSecurity } from "../index.js";
import type { PasskeyListItem } from "../types.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Переименование ключа доступа: открывает диалог с именем и сохраняет
 * новое имя (обновляет строку списка без перезагрузки).
 * @param form - Форма безопасности.
 * @param data - Данные ключа.
 * @param element - DOM-элемент строки ключа.
 * ***************************************************************************
 */
export function renamePasskeyHandler(form: UserSettingSecurity, data: PasskeyListItem, element: HTMLElement): void {

    try {

        // Диалог переименования
        new PasskeyRenameDialog({
            name: data.name,
            insertInto: form.modal?.content,
            callback: async (name) => {

                try {

                    // Пустое имя — сохранять нечего
                    if (!name) {
                        Toast.error(t("forms.user_setting_security.toasts.name_required"));
                        return;
                    }

                    // Запрос переименования
                    const response = await passkeyRenameRequest({
                        credential_id: data.credential_id,
                        name: name
                    });

                    // Проверка запроса
                    if (response.status) {

                        // Закрываем диалог
                        PasskeyRenameDialog.instance?.modal?.close();

                        // Обновляем имя в данных и DOM строки
                        data.name = name;
                        element.querySelector<HTMLElement>(".name")?.replaceChildren(document.createTextNode(name));

                        // Toast: ключ переименован
                        Toast.success(t("forms.user_setting_security.toasts.passkey_renamed"));

                    }

                } catch (error) {
                    Logger.error(error);

                    // Флаг, что тост уже показан
                    let isToastShown = false;

                    // Если ключ не найден
                    if (getErrorMessage(error).includes("NOT_FOUND")) {
                        Toast.error(t("forms.user_setting_security.toasts.passkey_not_found"));
                        isToastShown = true;
                    }

                    // Если имя пустое или слишком длинное
                    if (getErrorMessage(error).includes("NAME_REQUIRED") || getErrorMessage(error).includes("INVALID_NAME")) {
                        Toast.error(t("forms.user_setting_security.toasts.invalid_name"));
                        isToastShown = true;
                    }

                    // Если превышен лимит запросов
                    if (getErrorMessage(error).includes("RATE_LIMIT_EXCEEDED") || getErrorStatus(error) === 429) {
                        Toast.warning(t("forms.user_setting_security.toasts.too_many_requests"));
                        isToastShown = true;
                    }

                    // Если ошибка не распознана — показываем общую
                    if (!isToastShown) {
                        Toast.error(t("api.errors.server_error"));
                    }

                }

            }
        });

    } catch (error) {
        Logger.error(error);
    }

}
