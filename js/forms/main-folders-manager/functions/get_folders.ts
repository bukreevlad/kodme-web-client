// Импортируем config
import { MAIN_FOLDERS_PAGE_SIZE } from "../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { toastError } from "../../../utils/ui/toast_error.js";
import { IndexedDB } from "../../../utils/indexed_db.js";

// Импортируем requests
import { getFoldersRequest } from "../requests/get_folders.js";

// Импортируем типы
import type { MainFoldersManager } from "../index.js";
import type { MainFoldersAddOptions } from "../types.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * Минимальный интервал между одинаковыми тостами ошибки списка (мс).
 *
 * Подгрузка по скроллу идёт без участия пользователя: без подавления
 * недоступный сервер давал бы тост на каждый тик прокрутки — экран
 * забивался бы одинаковыми сообщениями. Подавление по времени сохраняет
 * обратную связь, но не превращает её в спам.
 */
const ERROR_TOAST_REPEAT_MS = 10000;

/**
 * Направление загрузки страницы списка папок.
 */
export interface GetFoldersOptions {

    /** Направление ["prev" | "next"]; отсутствует — первая страница. */
    direction?: "prev" | "next";

}

/**
 * ***************************************************************************
 * Загрузка страницы списка папок.
 *
 * Список «старые сверху, новые снизу» (по возрастанию id):
 * - первая загрузка (без direction) — от глобального минимума id,
 *   cursor не нужен;
 * - prev — папки старше minId, вставка в НАЧАЛО списка;
 * - next — папки новее maxId, вставка в КОНЕЦ списка.
 *
 * Каждая пачка обогащается локальными данными из IndexedDB (число чатов
 * и непрочитанных) и помечается признаком is_selected из selectedFolders —
 * иначе папки догруженных страниц отрисовались бы без счётчиков и без
 * отметки выбранности.
 *
 * Мягкая защита от последовательных запросов (без отмены запросов):
 * - флаг isLoading* на каждое направление: пока пачка не вернулась,
 *   повторные вызовы просто выходят (return);
 * - hasMore* === false — в направлении данных больше нет, не стучимся;
 * - ошибка сервера НЕ трогает hasMore*: сбой ≠ конец списка.
 *
 * @param form - Экземпляр формы.
 * @param options - Опции (direction — направление, без него первая страница).
 * ***************************************************************************
 */
export async function getFolders(form: MainFoldersManager, options: GetFoldersOptions = {}): Promise<void> {

    // Направление: undefined — первая страница
    const direction = options?.direction;

    // Проверка процесса: это направление уже грузится или его данные исчерпаны
    if (direction === "prev" && (form.isLoadingPrev || form.hasMorePrev === false)) return;
    if (direction === "next" && (form.isLoadingNext || form.hasMoreNext === false)) return;
    if (!direction && (form.isLoadingFirst || form.isFirstLoaded)) return;

    // Помечаем начало загрузки (снимается в finally)
    if (direction === "prev") form.isLoadingPrev = true;
    else if (direction === "next") form.isLoadingNext = true;
    else form.isLoadingFirst = true;

    try {

        // Устанавливаем cursorId: prev — крайняя старая папка, next — крайняя новая.
        // Граница стора StoreId (строка|число), курсор сервера — строка: читаем
        // только строку (id папок — UUID, практически всегда строки)
        let cursorId: string | undefined;
        if (direction === "prev") cursorId = typeof form.store.minId === "string" ? form.store.minId : undefined;
        if (direction === "next") cursorId = typeof form.store.maxId === "string" ? form.store.maxId : undefined;

        // Запрос (ответ status:false приходит уже как reject — ловит catch ниже)
        let response = await getFoldersRequest({
            cursor_id: cursorId,
            direction: direction,
            offset: MAIN_FOLDERS_PAGE_SIZE
        });

        // Неожиданный ответ — не гасим направление, просто выходим
        if (!Array.isArray(response?.data)) return;

        // ---------- HAS_MORE ----------
        // Сервер считает has_more по запрошенному направлению; для первой
        // страницы (порядок asc от глобального минимума) признак относится
        // к стороне next — «есть ли папки ниже». Сторону prev сразу
        // закрываем: без курсора страница начинается с самой старой папки,
        // старше нечего
        if (direction === "prev") {
            form.hasMorePrev = response.has_more === true;
        } else if (direction === "next") {
            form.hasMoreNext = response.has_more === true;
        } else {
            form.hasMoreNext = response.has_more === true;
            form.hasMorePrev = false;
            form.isFirstLoaded = true;
        }
        // ---------- HAS_MORE ----------

        // Якорь скролла ДО пачки: вставка в начало сдвинула бы
        // видимую часть списка вниз (для append восстановление даст ноль)
        form.listScrollManager?.saveAnchor();

        // Добавляем количество чатов и непрочитанных в каждой папке
        // (из локальной БД) — для каждой пачки, включая догруженные.
        // Таблица читается через общий Dexie API (db.table), а не через
        // свойство-слой: в типе IndexedDB.db нет объявленных таблиц
        await Promise.all(response.data.map(async folder => {

            // Записи без id не обогащаются и в Store не встанут — пропускаем
            if (!folder?.id) return;

            // Получаем каналы, которые лежат в этой папке
            let channels = await IndexedDB.db?.table("channels")
                ?.filter((channel: { main_folders_ids?: string[] }) => channel?.main_folders_ids?.includes(folder.id) === true)
                ?.toArray() || [];

            // Количество чатов в папке
            folder.chats_count = channels.length;

            // Сумма непрочитанных сообщений в папке
            folder.unread_count = channels.reduce((sum: number, channel: { total_unread_messages?: string }) => {
                return sum + (parseInt(String(channel?.total_unread_messages), 10) || 0);
            }, 0);

        }));

        // Проходим по массиву и добавляем в Store
        response.data.forEach(folder => {

            // Записи без id в Store не встанут — пропускаем
            if (!folder?.id) return;

            // Проверяем, выбрана ли папка в вызвавшей форме
            const isSelected = form?.selectedFolders?.some(f => f === folder.id) || false;

            // Помечаем как отмеченным (используем isSelected)
            folder.is_selected = isSelected;

            // Проверка в Store
            let isStore = form.store.get(folder.id);

            // Существующая запись обновляется, новая — добавляется с направлением
            // (direction: undefined для первой страницы → вставка в конец).
            // Опции — отдельной переменной: стор принимает StoreAddOptions
            // (без direction), литерал упёрся бы в проверку свежих объектов
            if (isStore) {
                form.store.update(folder.id, folder);
            } else {
                const addOptions: MainFoldersAddOptions = { direction };
                form.store.add(folder, addOptions);
            }

        });

        // Восстанавливаем якорь после пачки
        form.listScrollManager?.update();
        form.listScrollManager?.restoreAnchor();

        // Показываем/прячем пустое состояние (public API формы)
        form.updateEmptyState();

    } catch (error) {

        // Тост с троттлингом: фоновая догрузка не должна заливать экран
        toastErrorWithThrottle(form, error);

    } finally {

        // Флаги снимаем всегда: иначе после первой ошибки направление
        // не догружалось бы никогда
        if (direction === "prev") form.isLoadingPrev = false;
        else if (direction === "next") form.isLoadingNext = false;
        else form.isLoadingFirst = false;

    }

}

/**
 * ***************************************************************************
 * Приватный: показ ошибки загрузки с троттлингом.
 * @param form - Экземпляр формы (хранит время последнего тоста).
 * @param error - Ошибка из catch (ответ status:false приходит уже как reject).
 * ***************************************************************************
 */
function toastErrorWithThrottle(form: MainFoldersManager, error: unknown): void {

    try {

        // Не чаще ERROR_TOAST_REPEAT_MS на форму
        const now = Date.now();
        const lastToastAt = form.lastErrorToastAt || 0;
        if (now - lastToastAt < ERROR_TOAST_REPEAT_MS) return;
        form.lastErrorToastAt = now;

        // Показываем тост (коды ошибок разбирает сам toastError)
        toastError(error, {
            context: "[app][main-folders-manager][get-folders]",
            fallback: t("forms.main_folders_manager.toasts.load_error")
        });

    } catch (toastError_) {
        Logger.error("[app][main-folders-manager][get-folders][toast]:", toastError_);
    }

}