// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { toastError } from "../../../utils/ui/toast_error.js";

// Импортируем requests
import { getFolderRequest } from "../requests/get_folder.js";
import { openShareLinkRequest } from "../requests/open_share_link.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { CloudPaginationDirection } from "../types.js";
import type { CloudFolderContent, GetFolderData } from "../requests/get_folder.js";
import type { OpenShareLinkResult } from "../requests/open_share_link.js";
import type { Cloud } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * Минимальный интервал между одинаковыми тостами ошибки при догрузке по
 * скроллу (мс). Дозагрузка идёт без участия пользователя, поэтому без
 * подавления недоступный сервер дал бы тост на каждый тик прокрутки.
 */
const FOLDER_ERROR_TOAST_REPEAT_MS = 10000;

/**
 * Коды ошибок сервера, которые при загрузке папки означают «не удалось
 * загрузить содержимое» (отвечают за это запросы get_folder / open_share_link /
 * resolve_access).
 * ACCESS_DENIED сознательно НЕ в списке: у него есть глобальный текст в
 * `api.errors.access_denied`, он информативнее общего.
 */
const LOAD_ERROR_CODES = [
    "CURSOR_ID_INVALID",
    "DIRECTION_INVALID",
    "FOLDER_ID_INVALID",
    "FOLDER_NOT_FOUND",
    "ITEM_DELETED",
    "LINK_EXPIRED",
    "LINK_ID_INVALID",
    "LINK_INVALID",
    "LINK_NOT_FOUND",
    "LINK_REQUIRED",
    "OFFSET_INVALID",
    "USER_ID_INVALID",
    "USER_ID_REQUIRED"
];

/**
 * Опции загрузки содержимого папки.
 */
export interface GetFolderOptions {

    /** Загрузка по ссылке (общий доступ). */
    shared?: boolean;

    /** Id папки (по умолчанию — текущая папка режима). */
    folder_id?: string | null;

    /** Направление загрузки ["prev" | "next"]. Без направления — первая страница. */
    direction?: CloudPaginationDirection | null;

    /** Id записи старта. */
    cursor_id?: string | null;

    /** Вызов из скролл-пагинации: ошибка покажет тост с троттлингом (иначе — сразу). */
    fromScroll?: boolean;

}

/**
 * ***************************************************************************
 * Получение содержимого папки: своё облако ("get folder") или общий доступ
 * по ссылке ("open share link"). Папки всегда отдаются первыми и полностью,
 * файлы — порциями по offset (keyset-пагинация по id).
 *
 * Флаг первой страницы (`isFirstLoaded` / `sharedIsFirstLoaded`):
 * - сбрасывается в начале каждой загрузки без direction (навигация по
 *   папкам): пока ответ не применён, скролл-пагинация блокируется — иначе
 *   догрузка ушла бы со старым курсором на новую папку;
 * - выставляется при успешном ответе — разблокирует скролл-пагинацию и
 *   показ пустого состояния (см. `_updateEmptyStates`).
 * @param form - Экземпляр формы.
 * @param options - Настройки загрузки.
 * @returns Ответ сервера содержимым папки либо null при ошибке.
 * ***************************************************************************
 */
export async function getFolder(form: Cloud, options: GetFolderOptions = {}): Promise<Answer<CloudFolderContent> | Answer<OpenShareLinkResult> | null> {

    try {

        // Выставляем параметры
        let shared = options.shared || false;
        let folderId = options.folder_id ?? (shared ? form.sharedFolderId : form.currentFolderId);
        let store = shared ? form.sharedStore : form.store;
        let direction = options.direction || null;
        let cursorId = options.cursor_id || null;

        // Загрузка первой страницы папки начинается: скролл-пагинация
        // блокируется до применения ответа (гонка «новая папка + старый
        // курсор» — см. functions/load_more.ts)
        if (!direction) {
            if (shared) {
                form.sharedIsFirstLoaded = false;
            } else {
                form.isFirstLoaded = false;
            }
        }

        // Формируем данные запроса
        let payload: GetFolderData = {
            folder_id: folderId,
            direction: direction,
            cursor_id: cursorId,
            offset: form.offset || 50
        };

        // Если общий доступ — передаём ссылку
        if (shared) {
            payload.link = form.sharedLink?.link;
        } else {
            payload.link_id = null;
        }

        // Получаем содержимое папки
        let response = shared
            ? await openShareLinkRequest(payload)
            : await getFolderRequest(payload);

        // Если ответ успешный
        if (response.status && response.data) {

            // Если это не дозагрузка — очищаем хранилище и заполняем заново
            if (!direction) {
                store.removeAll();

                // Папки отображаются первыми и полностью
                (response.data.folders || []).forEach(folder => {
                    store.add({ ...folder, item_type: "folder" });
                });
            }

            // Файлы (порции по offset)
            let files = response.data.files || [];
            files.forEach(file => {
                store.add({ ...file, id: file.item_id, document_id: file.id, item_type: "file" });
            });

            // Обновляем параметры пагинации
            let cursor = files[files.length - 1]?.item_id ?? null;
            if (shared) {
                form.sharedHasMore = response.data.has_more || false;
                form.sharedCursorId = cursor;
            } else {
                form.hasMore = response.data.has_more || false;
                form.cursorId = cursor;
            }

            // Обновляем уровень доступа и владельца
            if (shared) {
                form.sharedAccessLevel = response.data.access_level || "owner";
                form.sharedOwnerUserId = response.data.owner_user_id || null;
            } else {
                form.accessLevel = response.data.access_level || "owner";
                form.ownerUserId = response.data.owner_user_id || null;
            }

            // Ответ применён — скролл-пагинация и пустое состояние разблокированы
            if (shared) {
                form.sharedIsFirstLoaded = true;
            } else {
                form.isFirstLoaded = true;
            }

            // Показываем пустое состояние при нулевом ответе: событие
            // item_added в этом случае не сработает, а вызывающий код
            // может не помнить про _updateEmptyStates
            form._updateEmptyStates();

        }

        return response;

    } catch (error) {

        // Тост об ошибке: навигация по папкам (пользователь нажал) — сразу,
        // догрузка по скроллу — не чаще раза в FOLDER_ERROR_TOAST_REPEAT_MS
        _toastError(form, error, {
            shared: options.shared || false,
            fromScroll: options.fromScroll || false
        });

        return null;
    }

}

/**
 * Приватный: показать тост об ошибке загрузки папки.
 * @param form - Экземпляр формы.
 * @param error - Ошибка.
 * @param options - Настройки показа.
 * @param options.shared - Контекст (общий доступ / своё облако).
 * @param options.fromScroll - Путь скролл-пагинации (троттлинг).
 */
function _toastError(form: Cloud, error: unknown, options: { shared: boolean, fromScroll: boolean }): void {

    // Догрузка по скроллу идёт без пользователя: повторные ошибки на тиках
    // прокрутки не должны заливать экран тостами
    if (options.fromScroll) {

        const now = Date.now();
        const key = options.shared ? "shared" : "mine";
        const last = form.folderErrorToasts[key] || 0;

        if (now - last < FOLDER_ERROR_TOAST_REPEAT_MS) {
            Logger.debug(`[app][cloud][get-folder][${key}]: повторная ошибка, тост подавлен`);
            return;
        }

        form.folderErrorToasts[key] = now;

    }

    // Коды + text: известные коды папки показывают человеческий текст,
    // остальное (таймаут, сеть, 5xx) разбирает toastError по api.errors
    toastError(error, {
        context: `[app][cloud][get-folder]${options.shared ? "[shared]" : ""}`,
        codes: LOAD_ERROR_CODES,
        text: t("forms.cloud.toasts.load_error"),
        fallback: t("forms.cloud.toasts.load_error")
    });

}
