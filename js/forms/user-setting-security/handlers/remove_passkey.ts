// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage, getErrorStatus } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { passkeyRemoveRequest } from "../requests/passkey_remove.js";

// Импортируем functions
import { updatePasskeysEmptyState } from "../functions/update_empty_state.js";

// Импортируем dialogs
import { PasskeyRemoveDialog } from "../dialogs/passkey_remove/index.js";

// Импортируем типы
import type { UserSettingSecurity } from "../index.js";
import type { PasskeyListItem } from "../types.js";

/**
 * ***************************************************************************
 * Удаление ключа доступа через диалог подтверждения.
 * @param form - Форма безопасности.
 * @param data - Данные удаляемого ключа.
 * ***************************************************************************
 */
export async function removePasskeyHandler(form: UserSettingSecurity, data: PasskeyListItem): Promise<void> {

    try {

        // Диалог подтверждения удаления ключа
        let dialogConfirm = new PasskeyRemoveDialog({
            name: data.name,
            insertInto: form.modal?.content,
            callback: async (response) => {

                try {

                    // Если пользователь отказался — ничего не делаем
                    if (!response) return;

                    // Запрос удаления
                    let result = await passkeyRemoveRequest({
                        credential_id: data.credential_id
                    });

                    // Проверка запроса
                    if (result.status) {

                        // Закрываем диалог
                        dialogConfirm?.modal?.close();

                        // Toast
                        Toast.success(window._lc.forms.user_setting_security.toasts.passkey_removed);

                        // Удаляем элемент из Store формы (DOM убирает событие item::removed)
                        form.store.remove(data.id);

                        // Обновляем заглушку пустого списка
                        updatePasskeysEmptyState(form);

                    }

                } catch (error) {
                    Logger.error(error);

                    // Флаг, что тост уже показан
                    let isToastShown = false;

                    // Если ключ не найден (уже удалён)
                    if (getErrorMessage(error).includes("NOT_FOUND")) {
                        Toast.error(window._lc.forms.user_setting_security.toasts.passkey_not_found);
                        isToastShown = true;

                        // Закрываем диалог (удалять больше нечего)
                        dialogConfirm?.modal?.close();
                    }

                    // Если превышен лимит запросов
                    if (getErrorMessage(error).includes("RATE_LIMIT_EXCEEDED") || getErrorStatus(error) === 429) {
                        Toast.warning(window._lc.forms.user_setting_security.toasts.too_many_requests);
                        isToastShown = true;
                    }

                    // Если ошибка не распознана — показываем общую
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
