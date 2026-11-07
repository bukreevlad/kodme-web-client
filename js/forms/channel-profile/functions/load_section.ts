// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { toastError } from "../../../utils/ui/toast_error.js";

// Импортируем config
import { CHANNEL_PROFILE_PAGE_SIZE } from "../../../config/constants.js";

// Импортируем core
import { ScrollManager } from "../../../core/managers/scroll_manager.js";

// Импортируем functions
import { updateSectionEmpty } from "./update_section_empty.js";

// Импортируем requests
import { sectionRequest } from "../requests/index.js";

// Импортируем типы
import type { ChannelProfile, MediaSection, SectionAddOptions } from "../types.js";

/**
 * ***************************************************************************
 * Минимальный интервал между одинаковыми тостами ошибки одной секции (мс).
 * Догрузка по скроллу идёт без участия пользователя, поэтому без подавления
 * недоступный сервер давал бы тост на каждый тик прокрутки.
 ***************************************************************************
 */
const SECTION_ERROR_TOAST_REPEAT_MS = 10000;

/**
 * Опции загрузки страницы секции.
 */
export interface LoadSectionOptions {

    /** Направление ["prev" | "next"]. Отсутствует — первая страница. */
    direction?: "prev" | "next";

}

/**
 * ***************************************************************************
 * Приватный: минимальная из двух строк-курсоров (undefined/null — нейтральный
 * элемент, чтобы reduce можно было стартовать с уже известной границы).
 *
 * UUIDv7 сравнимы лексикографически: фиксированный формат строки даёт порядок,
 * совпадающий с хронологическим.
 *
 * @param a - Текущая граница.
 * @param b - Кандидат.
 * @returns Меньшая строка.
 ***************************************************************************
 */
function _minCursor(a: string | undefined, b: string): string {
    return (a === undefined || a === null || b < a) ? b : a;
}

/**
 * ***************************************************************************
 * Приватный: максимальная из двух строк-курсоров (см. _minCursor).
 * @param a - Текущая граница.
 * @param b - Кандидат.
 * @returns Большая строка.
 ***************************************************************************
 */
function _maxCursor(a: string | undefined, b: string): string {
    return (a === undefined || a === null || b > a) ? b : a;
}

/**
 * ***************************************************************************
 * Читает курсор секции из динамического состояния формы.
 *
 * Курсор — attachment_id (UUIDv7, строка): не-строковое значение
 * трактуем как «курсор не задан» — direction-запрос без курсора серверу
 * не шлём (см. проверку ниже в loadSection).
 *
 * @param form - Экземпляр формы.
 * @param key - Ключ состояния (например "photosCursorMin").
 * @returns Курсор или undefined.
 ***************************************************************************
 */
function readCursor(form: ChannelProfile, key: string): string | undefined {
    const value: unknown = form[key];
    return typeof value === "string" ? value : undefined;
}

/**
 * ***************************************************************************
 * Загрузка страницы секции вкладки.
 *
 * Состояние пагинации секции выводится из section.id — в конструкторе формы
 * оно не перечисляется:
 *   <id>FirstLoaded, <id>LoadingFirst/Prev/Next,
 *   <id>HasMorePrev/Next, <id>CursorMin/Max, <id>ErrorToastAt.
 *
 * Список «новые сверху, старые снизу» (по убыванию id):
 * - первая загрузка (без direction) — от глобального максимума, cursor не
 *   нужен; после неё сторона next закрыта (новее глобального максимума
 *   в момент загрузки нет), живой путь — только prev;
 * - prev — записи старше CursorMin, вставка в КОНЕЦ списка;
 * - next — записи новее CursorMax, вставка в НАЧАЛО списка.
 *
 * Курсор — крайний attachment_id объектов ответа: у вложений поле id —
 * это id документа, курсором запроса оно не является (сервер сравнивает
 * по вложению). У «Ссылок» объект ответа — сообщение и его id совпадает
 * с курсором запроса, fallback `|| item.id` это учитывает.
 *
 * Мягкая защита от последовательных запросов (без отмены запросов):
 * - флаг isLoading* на каждое направление: пока пачка не вернулась,
 *   повторные вызовы просто выходят (return);
 * - hasMore* === false — в направлении данных больше нет, не стучимся;
 * - ошибка сервера НЕ трогает hasMore*: сбой ≠ конец списка.
 *
 * @param form - Экземпляр формы.
 * @param section - Описание секции (см. config/media_sections.ts).
 * @param options - Опции (direction — направление, без него первая страница).
 * @returns Promise<void>
 ***************************************************************************
 */
export async function loadSection(
    form: ChannelProfile,
    section: MediaSection,
    options: LoadSectionOptions = {}
): Promise<void> {

    if (!form || !section) return;

    // Направление: undefined — первая страница
    const direction = options?.direction;

    // Ключи состояния секции (выводятся из section.id)
    const firstLoadedKey = `${section.id}FirstLoaded`;
    const loadingFirstKey = `${section.id}LoadingFirst`;
    const loadingPrevKey = `${section.id}LoadingPrev`;
    const loadingNextKey = `${section.id}LoadingNext`;
    const hasMorePrevKey = `${section.id}HasMorePrev`;
    const hasMoreNextKey = `${section.id}HasMoreNext`;
    const cursorMinKey = `${section.id}CursorMin`;
    const cursorMaxKey = `${section.id}CursorMax`;
    const errorToastKey = `${section.id}ErrorToastAt`;

    // Проверка процесса: это направление уже грузится или его данные исчерпаны
    if (direction === "prev" && (form[loadingPrevKey] || form[hasMorePrevKey] === false)) return;
    if (direction === "next" && (form[loadingNextKey] || form[hasMoreNextKey] === false)) return;
    if (!direction && (form[loadingFirstKey] || form[firstLoadedKey])) return;

    // Помечаем начало загрузки (снимается в finally)
    if (direction === "prev") form[loadingPrevKey] = true;
    else if (direction === "next") form[loadingNextKey] = true;
    else form[loadingFirstKey] = true;

    try {

        // Получаем Store секции (список ещё не собран — нечего грузить)
        const store = form[section.storeKey];
        if (!store) return;

        // Устанавливаем курсор: prev — крайняя старая запись, next — крайняя новая
        let cursorId: string | undefined;
        if (direction === "prev") cursorId = readCursor(form, cursorMinKey);
        if (direction === "next") cursorId = readCursor(form, cursorMaxKey);

        // Без курсора direction-запрос вернул бы не ту страницу: сервер при
        // пустом cursor_id отдаёт первую страницу в выбранном направлении
        if (direction && !cursorId) {
            Logger.debug(`[app][channel-profile][load-section][${section.id}]: нет курсора для ${direction}`);
            return;
        }

        // Запрос
        const response = await sectionRequest(section.id, {
            channel_id: form.channelId,
            cursor_id: cursorId,
            direction: direction,
            offset: CHANNEL_PROFILE_PAGE_SIZE
        });

        // Неожиданный ответ: не гасим состояние (ошибка ≠ пустая страница).
        // Раньше не-массив молча трактовался как пустой результат
        if (!Array.isArray(response?.data)) {
            Logger.debug(`[app][channel-profile][load-section][${section.id}]: в ответе нет массива`, response);
            return;
        }

        const array = response.data;

        // ---------- HAS_MORE / ГРАНИЦЫ КУРСОРА ----------
        // Сервер считает has_more по запрошенному направлению; для первой
        // страницы (порядок desc от глобального максимума) признак
        // относится к стороне prev — «есть ли записи ниже». Сторону next
        // закрываем: новее глобального максимума в момент загрузки нет
        if (direction === "prev") {
            form[hasMorePrevKey] = response.has_more === true;
        } else if (direction === "next") {
            form[hasMoreNextKey] = response.has_more === true;
        } else {
            form[hasMorePrevKey] = response.has_more === true;
            form[hasMoreNextKey] = false;
            form[firstLoadedKey] = true;
        }

        // Границы курсора обновляем только со стороны направления, чтобы
        // пачка prev не сдвинула верхнюю границу вниз (и наоборот). Записи
        // без id в курсор не попадают — они же не встанут и в Store;
        // курсор — только строки (см. readCursor)
        const cursors = array
            .filter(item => item?.id)
            .map(item => item.attachment_id || item.id)
            .filter((id): id is string => typeof id === "string");

        if (cursors.length) {
            if (direction === "prev") {
                form[cursorMinKey] = cursors.reduce(_minCursor, readCursor(form, cursorMinKey));
            } else if (direction === "next") {
                form[cursorMaxKey] = cursors.reduce(_maxCursor, readCursor(form, cursorMaxKey));
            } else {
                form[cursorMinKey] = cursors.reduce(_minCursor);
                form[cursorMaxKey] = cursors.reduce(_maxCursor);
            }
        }
        // ---------- HAS_MORE / ГРАНИЦЫ КУРСОРА ----------

        // Якорь скролла ДО пачки: вставка в начало сдвинула бы видимую
        // часть панели вниз (для append восстановление даст ноль).
        // Менеджер создаётся в build_sections — вне этого пути его нет
        const rawScrollManager: unknown = form[`${section.id}ScrollManager`];
        const scrollManager = rawScrollManager instanceof ScrollManager ? rawScrollManager : null;
        scrollManager?.saveAnchor();

        // Проходим по массиву и добавляем в Store
        for (const item of array) {

            // Записи без id в Store не встанут — пропускаем
            if (!item?.id) continue;

            // Существующая запись обновляется, новая — добавляется с направлением
            // (direction: undefined для первой страницы → вставка в конец)
            if (store.get(item.id)) {
                store.update(item.id, item);
                continue;
            }

            // Опции добавления: direction передаёт подписчику subscribe_section
            // (куда вставлять строку). Переменная, а не литерал: поле не входит
            // в базовые опции Store, но контракт секции свой
            const addOptions: SectionAddOptions = { direction };
            store.add(item, addOptions);

        }

        // Восстанавливаем якорь после пачки
        scrollManager?.update();
        scrollManager?.restoreAnchor();

        // Показываем/прячим пустое состояние секции
        updateSectionEmpty(form, section);

    } catch (error) {

        // Ошибка сервера (status: false сокет превращает в reject — она
        // попадает сюда): логируем и показываем тост с троттлингом по
        // секции. hasMore* не трогаем — однократный сбой не должен
        // навсегда закрыть направление загрузки
        Logger.error(`[app][channel-profile][load-section][${section.id}]:`, error);

        try {

            // Не чаще SECTION_ERROR_TOAST_REPEAT_MS на секцию: догрузка по
            // скроллу идёт без участия пользователя, и при недоступном
            // сервере каждый тик скролла дал бы свой тост
            const now = Date.now();
            const storedToastAt: unknown = form[errorToastKey];
            const lastToastAt = typeof storedToastAt === "number" ? storedToastAt : 0;
            if (now - lastToastAt >= SECTION_ERROR_TOAST_REPEAT_MS) {
                form[errorToastKey] = now;
                toastError(error, {
                    context: `[app][channel-profile][load-section][${section.id}]`,
                    fallback: window._lc?.forms?.channel_profile?.toasts?.load_media_error
                });
            }

        } catch (toastError) {
            Logger.error(`[app][channel-profile][load-section][${section.id}][toast]:`, toastError);
        }

    } finally {

        // Флаги снимаем всегда: иначе после первой ошибки направление
        // не догружалось бы никогда
        if (direction === "prev") form[loadingPrevKey] = false;
        else if (direction === "next") form[loadingNextKey] = false;
        else form[loadingFirstKey] = false;

    }

}
