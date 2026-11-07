// Импортируем utils
import { toastError } from "../../../utils/ui/toast_error.js";

// Импортируем requests
import { getAvailableLinksRequest } from "../requests/get_available_links.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { CloudAvailableLink } from "../types.js";
import type { Cloud } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Получение списка «Доступное для меня» — ссылок, открытых и сохранённых
 * пользователем. Заполняет хранилище ссылок формы.
 *
 * Флаг `availableIsFirstLoaded` нужен `_updateEmptyStates`: пустое состояние
 * вкладки показывается только после успешного ответа — падение первого
 * запроса не должно выглядеть как «ссылок нет».
 * @param form - Экземпляр формы.
 * @returns Ответ сервера списком ссылок либо null при ошибке.
 * ***************************************************************************
 */
export async function getAvailableLinks(form: Cloud): Promise<Answer<CloudAvailableLink[]> | null> {

    try {

        // Запрос начался — показ пустого состояния заблокирован до ответа
        form.availableIsFirstLoaded = false;

        // Запрос на сервер
        let response = await getAvailableLinksRequest({});

        // Если ответ успешный
        if (response.status && response.data) {

            // Очищаем хранилище
            form.availableStore.removeAll();

            // Заполняем хранилище ссылками
            (response.data || []).forEach(link => {
                form.availableStore.add({ ...link, id: link.link_id });
            });

            // Ответ применён — пустое состояние вкладки разблокировано
            form.availableIsFirstLoaded = true;

            // Показываем пустое состояние сразу: _setMode не ждёт этот
            // запрос, и без явного вызова «ссылок нет» не появилось бы
            // при нулевом ответе (item_added сработал бы только при ссылках)
            form._updateEmptyStates();

        }

        return response;

    } catch (error) {

        // Тост вместо молчаливого Logger: пользователь открыл вкладку
        // и должен понимать, что список не загрузился
        toastError(error, {
            context: "[app][cloud][get-available-links]",
            codes: ["USER_ID_INVALID", "USER_ID_REQUIRED"],
            text: t("forms.cloud.toasts.load_links_error"),
            fallback: t("forms.cloud.toasts.load_links_error")
        });

        return null;
    }

}
