// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { toastError } from "../../../utils/ui/toast_error.js";

// Импортируем config формы
import { SECTIONS, SECTION_IDS } from "../config/sections.js";

// Импортируем requests
import { sectionRequest } from "../requests/index.js";

// Импортируем functions
import { setSectionState } from "./set_section_state.js";

// Импортируем типы
import type { SectionId } from "../config/sections.js";
import type { Search } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Коды ошибок сервера для категорий поиска (секция get_* запросов поиска),
 * чтобы тост не показывал пользователю техническое «USER_ID_REQUIRED».
 * Набор одинаков для всех категорий, но перечислен явно: при расхождении с
 * сервером правится одно место.
 ***************************************************************************
 */
const ERROR_CODES = [
    "INVALID_CURSOR_ID",
    "INVALID_DIRECTION",
    "INVALID_OFFSET",
    "INVALID_USER_ID",
    "USER_ID_REQUIRED"
];

/**
 * ***************************************************************************
 * Первичная загрузка всех разрешённых категорий поиска.
 *
 * - запросы идут ПАРАЛЛЕЛЬНО через Promise.all;
 * - ошибка одной категории НЕ отменяет остальные: у каждой категории свой
 *   тост с кодом ошибки и своим текстом;
 * - поздние ответы (форма уже закрыта) отбрасываются, чтобы не воскрешать DOM.
 *
 * Функция намеренно НЕ await-ится в _onBeforeOpen: форма показывается сразу,
 * данные подставляются через события item::added.
 *
 * @param form - Экземпляр формы.
 * @returns Promise<void>
 ***************************************************************************
 */
export async function firstLoaded(form: Search): Promise<void> {

    if (!form) return;

    // Загружаем только разрешённые категории
    const names = SECTION_IDS
        .filter(id => form.allowSearchType?.includes(id));

    if (!names.length) return;

    // Форма закрылась, пока открывали её сами (см. B1: старая форма закрывается)
    if (form.isClosed) return;

    // Показываем состояние загрузки для каждой вкладки, чтобы пустой список
    // не выглядел как «ничего не найдено»
    for (const id of names) {
        setSectionState(form, id, "loading");
    }

    // Ждём все категории сразу: успешные отвечают независимо, упавшие не блокируют
    await Promise.all(names.map(id => loadFirstPage(form, id)));

}

/**
 * ***************************************************************************
 * Загрузка первой страницы одной категории поиска.
 * @param form - Экземпляр формы.
 * @param id - Имя категории ["channels" | "groups" | "users" | "bots"].
 * @returns Promise<void>
 ***************************************************************************
 */
async function loadFirstPage(form: Search, id: SectionId): Promise<void> {

    const config = SECTIONS[id];

    try {

        // Форма могла закрыться, пока летел предыдущий запрос
        if (form.isClosed) return;

        // Запрос первой страницы без фильтра
        const response = await sectionRequest(id, { search: "" });

        // Форма закрылась за время запроса — ответ выбрасываем
        if (form.isClosed) return;

        // Неожиданный ответ: не гасим состояние (ошибка ≠ пустая вкладка)
        if (!Array.isArray(response?.data)) {
            Logger.error(`[app][search][first-loaded][${id}]: в ответе нет массива`, response);
            setSectionState(form, id, "error");
            return;
        }

        const store = form.stores[id];

        // Заполняем стор: подписчики item::added сами создадут строки
        for (const item of response.data) {
            if (!item?.id) continue;
            store.add(item);
        }

        // Состояние пагинации первой страницы: дальше по скроллу едет только
        // side next (первый матч — самый старый id, глобального минимума ниже
        // него не бывает), поэтому prev закрываем сразу. Курсор — крайние
        // id стора: у поисковых записей id и есть курсор запроса
        const state = form.pagination[id];
        state.firstLoaded = true;
        state.hasMorePrev = false;
        state.hasMoreNext = response.has_more === true;

        // Есть данные — прячем служебное состояние; нет — честное «ничего не найдено»
        setSectionState(form, id, store.size ? null : "empty");

    } catch (error) {

        // Форма закрылась, пока летел запрос. Ошибка закрытой формы неактуальна:
        // пользователь уже ушёл, и тост об ошибке вкладки был бы шумом
        if (form.isClosed) return;

        // Одна упавшая категория не должна мешать остальным: ловим здесь
        Logger.error(`[app][search][first-loaded][${id}]:`, error);

        setSectionState(form, id, "error");

        // Тост: коды ошибок сервера приходят в message ("USER_ID_REQUIRED :: 122404"),
        // поэтому сопоставляем и по имени, и по коду. Приоритет — наши тексты,
        // так как ошибки поиска относятся к конкретной вкладке
        toastError(error, {
            context: `[app][search][first-loaded][${id}]`,
            codes: ERROR_CODES,
            fallback: t("forms.search.toasts.load_error")
        });

    }

}
