// Импортируем config
import { MEMBERS_PAGE_SIZE } from "../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { toastError } from "../../../utils/ui/toast_error.js";

// Импортируем functions
import { updateEmptyState } from "./update_empty_state.js";

// Импортируем requests
import { getMembersRequest } from "../requests/get_members.js";

// Импортируем типы
import type { MemberAddOptions, MemberPaginationDirection } from "../types.js";
import type { ChannelMembers } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Минимальный интервал между одинаковыми тостами ошибки списка (мс).
 *
 * Подгрузка по скроллу идёт без участия пользователя: без подавления
 * недоступный сервер давал бы тост на каждый тик прокрутки.
 * ***************************************************************************
 */
const ERROR_TOAST_REPEAT_MS = 10000;

/**
 * ***************************************************************************
 * Загрузка страницы списка участников канала.
 *
 * Список «старые сверху, новые снизу» (по возрастанию UUID v7):
 * - первая загрузка (без direction) — от глобального минимума id;
 * - prev — участники старше minId, вставка в НАЧАЛО списка;
 * - next — участники новее maxId, вставка в КОНЕЦ списка.
 *
 * Флаг isLoading* на каждое направление закрывает параллельные запросы,
 * hasMore* === false — направление исчерпано; ошибка сервера флаги не
 * трогает (сбой ≠ конец списка).
 * @param form - Экземпляр формы.
 * @param options - Опции.
 * @param options.direction - Направление ["prev" | "next"].
 *   Отсутствует — первая страница.
 * @returns Promise, разрешающийся после завершения загрузки.
 * ***************************************************************************
 */
export async function getMembers(form: ChannelMembers, options: { direction?: MemberPaginationDirection } = {}): Promise<void> {

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

        // Устанавливаем cursorId: prev — крайний старый id, next — крайний новый.
        // invariant: id участника — UUID-строка (id Postgres), край стора
        // безопасно приводится к string
        let cursorId: string | undefined;
        if (direction === "prev") cursorId = form.store.minId as string;
        if (direction === "next") cursorId = form.store.maxId as string;

        // Запрос (ошибки сервера сокет пробрасывает reject'ом — ловим в catch)
        const response = await getMembersRequest({
            channel_id: form.channelId,
            cursor_id: cursorId,
            direction: direction,
            offset: MEMBERS_PAGE_SIZE
        });

        // Неожиданный ответ — не гасим направление, просто выходим
        if (!Array.isArray(response?.data)) return;

        // ---------- HAS_MORE ----------
        // Для первой страницы признак относится к стороне next; сторону
        // prev закрываем сразу: без курсора страница начинается с самого
        // старого id, старше нечего
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

        // Направление вставки стор прокидывает в событие item::added
        // (см. events/store/item_added.ts)
        const addOptions: MemberAddOptions = { direction: direction };

        // Проходим по массиву и добавляем в Store
        response.data.forEach(item => {

            // Записи без id в Store не встанут — пропускаем
            if (!item?.id) return;

            // Существующая запись обновляется, новая — добавляется с направлением
            const isStore = form.store.get(item.id);
            if (isStore) {
                form.store.update(item.id, item);
            } else {
                form.store.add(item, addOptions);
            }

        });

        // Восстанавливаем якорь после пачки
        form.listScrollManager?.update();
        form.listScrollManager?.restoreAnchor();

        // Показываем/прячем пустое состояние списка
        updateEmptyState(form);

    } catch (error) {

        // Тост с троттлингом: фоновая догрузка не должна заливать экран
        _toastError(form, error);

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
 * @param error - Ошибка из catch.
 * ***************************************************************************
 */
function _toastError(form: ChannelMembers, error: unknown): void {

    try {

        // Не чаще ERROR_TOAST_REPEAT_MS на форму
        const now = Date.now();
        const lastToastAt = form.lastErrorToastAt || 0;
        if (now - lastToastAt < ERROR_TOAST_REPEAT_MS) return;
        form.lastErrorToastAt = now;

        // Показываем тост (коды ошибок разбирает сам toastError)
        toastError(error, {
            context: "[app][channel-members][get-members]",
            fallback: t("forms.channel_members.toasts.load_error")
        });

    } catch (toastError) {
        Logger.error("[app][channel-members][get-members][toast]:", toastError);
    }

}
