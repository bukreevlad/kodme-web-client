// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { toastError } from "../../../utils/ui/toast_error.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем requests
import { openShareLinkRequest } from "../requests/open_share_link.js";

// Импортируем dialogs
import { CloudFileInfo } from "../dialogs/file_info/index.js";

// Импортируем типы
import type { Cloud } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * Коды ошибок «ссылка недействительна»: отозвана, истекла, на удалённый
 * файл (отвечают за это запросы open_share_link / get_share_link).
 */
const LINK_ERROR_CODES = ["ITEM_DELETED", "LINK_EXPIRED", "LINK_INVALID", "LINK_NOT_FOUND", "LINK_REQUIRED"];

/**
 * ***************************************************************************
 * Открытие ссылки общего доступа по её токену:
 * - ссылка на файл — окно с информацией о файле и кнопкой скачивания;
 * - ссылка на папку — переход в режим общего доступа с этой папкой.
 * @param form - Экземпляр формы облака.
 * @param link - Значение ссылки (токен).
 * @returns Успешно ли открыта ссылка.
 * ***************************************************************************
 */
export async function openShareLinkHandler(form: Cloud, link: string): Promise<boolean> {

    try {

        // Открываем ссылку
        let response = await openShareLinkRequest({ link });

        // Если ссылка недействительна
        if (!response.status || !response.data) {
            Toast.error(t("forms.cloud.toasts.link_not_valid"));
            return false;
        }

        // Распаковываем ответ
        let { item, owner, file } = response.data;

        // ---------- ССЫЛКА НА ФАЙЛ ----------
        if (item?.item_type === "file" && file) {

            // Открываем окно с информацией о файле и кнопкой скачивания
            new CloudFileInfo({ link, item, file, owner });
            return true;

        }

        // ---------- ССЫЛКА НА ПАПКУ ----------
        if (item?.item_type === "folder") {

            // Сохраняем данные ссылки для навигации
            form.sharedLink = {
                ...response.data.link,
                item: item,
                owner: owner,
                access_level: response.data.access_level || "read"
            };

            // Уровень доступа текущего пользователя по ссылке (read / write / owner).
            // Выставляется ДО наполнения хранилища: компоненты элементов читают
            // его при создании и без этого показывают устаревший уровень
            // предыдущей ссылки
            form.sharedAccessLevel = response.data.access_level || form.sharedLink?.access_level || "read";

            // Сбрасываем состояние навигации
            form.sharedPath = [];
            form.sharedFolderId = null;

            // Очищаем хранилище общего доступа
            form.sharedStore.removeAll();

            // Заполняем хранилище содержимым папки
            (response.data.folders || []).forEach(folder => {
                form.sharedStore.add({ ...folder, item_type: "folder" });
            });

            let files = response.data.files || [];
            files.forEach(fileItem => {
                form.sharedStore.add({ ...fileItem, id: fileItem.item_id, document_id: fileItem.id, item_type: "file" });
            });

            // Обновляем параметры пагинации
            form.sharedHasMore = response.data.has_more || false;
            form.sharedCursorId = files[files.length - 1]?.item_id ?? null;
            form.sharedOwnerUserId = response.data.owner_user_id || response.data.link?.owner_user_id || null;

            // Ответ применён — скролл-пагинация и пустое состояние
            // общего доступа разблокированы (выставляется ДО _setMode,
            // он обновляет пустые состояния)
            form.sharedIsFirstLoaded = true;

            // Переключаем форму в режим общего доступа
            form._setMode("shared");

            return true;

        }

        return false;

    } catch (error) {

        // Разбираем код ошибки: отозванная/истёкшая ссылка — свой текст,
        // остальное — общий текст ошибки загрузки
        let message = String(typeof error === "object" && error !== null && "message" in error
            ? error.message
            : "");

        if (LINK_ERROR_CODES.some(code => message.includes(code))) {
            Logger.error("[app][cloud][open-share-link]:", error);
            Toast.error(t("forms.cloud.toasts.link_not_valid"));
        } else {
            toastError(error, {
                context: "[app][cloud][open-share-link]",
                codes: ["CURSOR_ID_INVALID", "DIRECTION_INVALID", "OFFSET_INVALID", "USER_ID_INVALID", "USER_ID_REQUIRED"],
                text: t("forms.cloud.toasts.load_error"),
                fallback: t("forms.cloud.toasts.load_error")
            });
        }

        return false;
    }

}
