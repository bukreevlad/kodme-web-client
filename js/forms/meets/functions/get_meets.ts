// Импортируем config
import { MEETS_PAGE_SIZE } from "../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { toastError } from "../../../utils/ui/toast_error.js";

// Импортируем functions
import { updateEmptyState } from "./update_empty_state.js";

// Импортируем requests
import { getMeetsRequest } from "../requests/get_meets.js";

// Импортируем типы
import type { StoreId } from "../../../utils/store.js";
import type { MeetDirection, MeetStoreAddOptions } from "../types.js";
import type { Meets } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Минимальный интервал между одинаковыми тостами ошибки списка (мс).
 *
 * Подгрузка по скроллу идёт без участия пользователя: без подавления
 * недоступный сервер давал бы тост на каждый тик прокрутки — экран
 * забивался бы одинаковыми сообщениями. Подавление по времени сохраняет
 * обратную связь, но не превращает её в спам.
 ***************************************************************************
 */
const ERROR_TOAST_REPEAT_MS = 10000;

/**
 * Опции загрузки страницы конференций.
 */
export interface GetMeetsOptions {

    /**
     * Направление ["prev" | "next"]. Отсутствует — первая страница.
     */
    direction?: MeetDirection;

}

/**
 * ***************************************************************************
 * Загрузка страницы списка конференций.
 *
 * Список «старые сверху, новые снизу» (по возрастанию id):
 * - первая загрузка (без direction) — от глобального минимума id,
 *   cursor не нужен;
 * - prev — записи старше minId, вставка в НАЧАЛО списка;
 * - next — записи новее maxId, вставка в КОНЕЦ списка.
 *
 * Мягкая защита от последовательных запросов (без отмены запросов):
 * - флаг isLoading* на каждое направление: пока пачка не вернулась,
 *   повторные вызовы просто выходят (return);
 * - hasMore* === false — в направлении данных больше нет, не стучимся;
 * - ошибка сервера НЕ трогает hasMore*: сбой ≠ конец списка.
 *
 * @param form - Экземпляр формы.
 * @param options - Опции.
 * @param options.direction - Направление ["prev" | "next"]. Отсутствует —
 *   первая страница.
 * @returns Promise без значения.
 ***************************************************************************
 */
export async function getMeets(form: Meets, options: GetMeetsOptions = {}): Promise<void> {

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

        // Устанавливаем cursorId: prev — крайний старый id, next — крайний новый
        let cursorId: StoreId | null = null;
        if (direction === "prev") cursorId = form.store.minId;
        if (direction === "next") cursorId = form.store.maxId;

        // Запрос
        let response = await getMeetsRequest({
            cursor_id: cursorId,
            direction: direction,
            offset: MEETS_PAGE_SIZE
        });

        // Неожиданный ответ — не гасим направление, просто выходим.
        // Ответ status: false отклоняется сокетом и попадает в catch ниже
        // (тост с троттлингом, флаги hasMore* не трогаются)
        if (!Array.isArray(response?.data)) return;

        // ---------- HAS_MORE ----------
        // Сервер считает has_more по запрошенному направлению; для первой
        // страницы (порядок asc от глобального минимума) признак относится
        // к стороне next — «есть ли записи ниже». Сторону prev сразу
        // закрываем: без курсора страница начинается с самого старого id,
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

        // Опции добавления: направление уходит в стор и дальше — в карточку
        // списка (см. MeetStoreAddOptions)
        const addOptions: MeetStoreAddOptions = { direction: direction };

        // Проходим по массиву и добавляем в Store
        response.data.forEach(item => {

            // Записи без id в Store не встанут — пропускаем
            if (!item?.id) return;

            // Проверка в Store
            let isStore = form.store.get(item.id);

            // Существующая запись обновляется, новая — добавляется с направлением
            // (direction: undefined для первой страницы → вставка в конец)
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
        toastErrorOnce(form, error);

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
 * @param error - Ошибка запроса из catch.
 ***************************************************************************
 */
function toastErrorOnce(form: Meets, error: unknown): void {

    try {

        // Не чаще ERROR_TOAST_REPEAT_MS на форму
        const now = Date.now();
        const lastToastAt = form.lastErrorToastAt || 0;
        if (now - lastToastAt < ERROR_TOAST_REPEAT_MS) return;
        form.lastErrorToastAt = now;

        // Показываем тост (коды ошибок разбирает сам toastError)
        toastError(error, {
            context: "[app][meets][get-meets]",
            fallback: t("forms.meets.toasts.load_error")
        });

    } catch (toastError) {
        Logger.error("[app][meets][get-meets][toast]:", toastError);
    }

}
