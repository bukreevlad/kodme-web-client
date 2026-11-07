// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { passkeyListRequest } from "../requests/passkey_list.js";

// Импортируем components
import { createPasskeyItem } from "../components/passkey_item.js";

// Импортируем functions
import { updatePasskeysEmptyState } from "./update_empty_state.js";

// Импортируем типы
import type { UserSettingSecurity } from "../index.js";
import type { PasskeyListItem } from "../types.js";

/**
 * ***************************************************************************
 * Загрузка списка ключей доступа и их рендер (используется при открытии
 * формы и после добавления ключа — перерисовывает список целиком).
 * @param form - Форма безопасности.
 * ***************************************************************************
 */
export async function getPasskeys(form: UserSettingSecurity): Promise<void> {

    try {

        // Запрос списка ключей
        const response = await passkeyListRequest();

        // Проверка запроса
        if (!response.status) return;

        // Очищаем хранилище и DOM-список (повторная загрузка перерисовывает всё)
        form.store.removeAll({ silent: true });
        form.passkeyList?.replaceChildren();

        // Рендерим ключи
        response.data.forEach((row) => {

            // Данные элемента: id Store = идентификатор credential'а
            const item: PasskeyListItem = { ...row, id: row.credential_id };

            // Создаём и вставляем DOM-элемент строки
            const element = createPasskeyItem(form, item);
            form.passkeyList?.appendChild(element);

            // Добавляем элемент в хранилище
            form.store.add(item);

        });

        // Обновляем заглушку пустого списка
        updatePasskeysEmptyState(form);

    } catch (error) {
        Logger.error(error);

        // Если ключи доступа запрещены на сервере — прячем карточку целиком
        if (getErrorMessage(error).includes("DISABLED")) {
            form.passkeysCard?.classList.add("hidden");
            return;
        }

        // Прочая ошибка сервера
        Toast.error(window._lc.api.errors.server_error ?? "Ошибка сервера");
    }

}
