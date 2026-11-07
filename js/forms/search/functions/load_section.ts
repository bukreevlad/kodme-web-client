// Импортируем config
import { SEARCH_PAGE_SIZE } from "../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { toastError } from "../../../utils/ui/toast_error.js";

// Импортируем config формы
import { SECTIONS } from "../config/sections.js";

// Импортируем requests
import { sectionRequest } from "../requests/index.js";

// Импортируем типы
import type { SectionId } from "../config/sections.js";
import type { SearchSection } from "../config/sections.js";
import type { SearchStoreAddOptions } from "../types.js";
import type { Search } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Минимальный интервал между одинаковыми тостами ошибки одной категории (мс).
 * Догрузка по скроллу идёт без участия пользователя, поэтому без подавления
 * недоступный сервер давал бы тост на каждый тик прокрутки.
 ***************************************************************************
 */
const SECTION_ERROR_TOAST_REPEAT_MS = 10000;

/**
 * Опции догрузки соседней страницы категории поиска.
 */
export interface LoadSectionOptions {

    /** Направление ["prev" | "next"]. По умолчанию "next". */
    direction?: "prev" | "next";

}

/**
 * ***************************************************************************
 * Догрузка соседней страницы одной категории поиска.
 *
 * Замена четырёх функций load_channels/load_groups/load_users/load_bots,
 * которые различались стором, флагом и строкой события. Что здесь принципиально:
 *
 * 1. Состояние пагинации живёт в `form.pagination[id]` (см. SectionPagination),
 *    а не в захардкоженных строковых ключах. Именно из-за копипасты `load_users`
 *    и `load_bots` пользовались `form.isGroupsLoading`: у трёх вкладок из
 *    четырёх был общий флаг, и скролл списка людей молча блокировал догрузку
 *    групп.
 *
 * 2. Флаг направления снимается в `finally`. Раньше при `return` без cursor_id
 *    флаг снимался вручную, а при ошибке — в `finally`; если между этими
 *    ветками добавить ещё один выход, вкладка перестала бы догружаться
 *    навсегда.
 *
 * 3. `has_more` ответа (сервер, A0) отражается в hasMorePrev/hasMoreNext:
 *    направление с `has_more=false` больше не стучится к серверу на каждом
 *    тике скролла.
 *
 * 4. Запрос берёт ПРИМЕНЁННЫЙ запрос из `form.search`, а не «живое» значение
 *    поля ввода. Иначе можно было изменить текст, не нажав «Поиск», и догрузка
 *    поехала бы по новой строке со старым курсором — список становился
 *    смешанным. Ответ дополнительно сверяется с применённым запросом:
 *    поздняя страница старого поиска не встаёт в список нового.
 *
 * 5. Поздний ответ закрытой формы отбрасывается: загрузка неблокирующая, и
 *    без проверки форма воскрешала бы DOM после закрытия.
 *
 * @param form - Экземпляр формы.
 * @param section - Описание категории (см. config/sections.ts).
 * @param options - Опции.
 * @returns true, если страница запрошена.
 ***************************************************************************
 */
export async function loadSection(form: Search, section: SearchSection, options: LoadSectionOptions = {}): Promise<boolean> {

    // Категория обязана быть известна. Без этой проверки опечатка в имени или
    // объект конфига без `id` приводили к тихому `return false`: догрузка по
    // скроллу просто не работала, без запроса и без сообщения
    if (!form || !section?.id) {
        Logger.error(`[app][search][load-section]: неизвестная категория «${section?.id ?? section}»`);
        return false;
    }

    const id: SectionId = section.id;
    const direction = options.direction === "prev" ? "prev" : "next";
    const store = form.stores[id];
    const state = form.pagination[id];

    // Форму закрыли, пока висел предыдущий запрос
    if (form.isClosed) return false;

    // Первая страница не применена — курсор и has_more неизвестны, а
    // запрос без курсора вернул бы глобальную первую страницу
    if (!state.firstLoaded) return false;

    // Догрузка этой категории в этом направлении уже идёт — второй
    // параллельный запрос не нужен. Флаги раздельные: скролл prev не
    // должен блокировать next и наоборот
    if (direction === "prev" ? state.loadingPrev : state.loadingNext) return false;

    // В направлении данных больше нет (has_more=false первой страницы
    // или последней пачки) — не стучимся на каждом тике скролла
    if ((direction === "prev" ? state.hasMorePrev : state.hasMoreNext) === false) return false;

    // Крайний id: для prev — минимальный, для next — максимальный.
    // Нет id — значит хранилище пусто, и догруживать нечего
    const cursorId = direction === "prev" ? store?.minId : store?.maxId;
    if (!cursorId) return false;

    // Применённая строка поиска: фиксируем ДО запроса, а после ответа
    // сверяем — если пользователь успел применить другой «Поиск», эта
    // страница устарела и в список не встаёт
    const requestedSearch = form.search || "";

    if (direction === "prev") state.loadingPrev = true;
    else state.loadingNext = true;

    try {

        const response = await sectionRequest(id, {
            search: requestedSearch,
            cursor_id: cursorId,
            direction: direction,
            offset: SEARCH_PAGE_SIZE
        });

        // Форма закрылась за время запроса — ответ выбрасываем
        if (form.isClosed) return false;

        // Пока летел запрос, применили другой «Поиск»: страница устарела
        if ((form.search || "") !== requestedSearch) return false;

        // Неожиданный ответ: не гасим состояние (ошибка ≠ конец списка).
        // Раньше не-массив молча считался пустой страницей
        if (!Array.isArray(response?.data)) {
            Logger.debug(`[app][search][load-section][${id}]: в ответе нет массива`, response);
            return false;
        }

        // Сервер считает has_more по запрошенному направлению
        const hasMore = response.has_more === true;
        if (direction === "prev") state.hasMorePrev = hasMore;
        else state.hasMoreNext = hasMore;

        // Якорь скролла ДО пачки: вставка в начало сдвинула бы видимую
        // часть панели вниз (для append восстановление даст ноль)
        const scrollManager = form.scrollManagers[id];
        scrollManager?.saveAnchor();

        // Направление уходит в Store: prev-пачка препендится в начало
        // (сервер отдаёт её по убыванию id, последовательный prepend
        // складывает список в возрастающем порядке)
        // Стор пробрасывает options подписчикам item::added как есть,
        // поэтому имя опции объявлено в SearchStoreAddOptions
        const addOptions: SearchStoreAddOptions = { direction };
        for (const item of response.data) {
            if (!item?.id) continue;
            store.add(item, addOptions);
        }

        // Восстанавливаем якорь после пачки
        scrollManager?.update();
        scrollManager?.restoreAnchor();

        return true;

    } catch (error) {

        // Фоновая догрузка: пользователь ничего не нажимал, поэтому полноценный
        // тост на каждый тик прокрутки был бы шумом. Показываем его не чаще
        // раза в SECTION_ERROR_TOAST_REPEAT_MS на категорию
        toastOnce(form, id, error);

        return false;

    } finally {

        // Флаг снимается всегда: иначе после первой ошибки вкладка
        // перестала бы догружаться до перезагрузки страницы
        if (direction === "prev") state.loadingPrev = false;
        else state.loadingNext = false;

    }

}

/**
 * ***************************************************************************
 * Приватный: показать тост об ошибке догрузки, не чаще раза в
 * SECTION_ERROR_TOAST_REPEAT_MS на категорию.
 * @param form - Экземпляр формы (хранит время последнего тоста по категориям).
 * @param id - Категория.
 * @param error - Ошибка.
 ***************************************************************************
 */
function toastOnce(form: Search, id: SectionId, error: unknown): void {

    const now = Date.now();
    const last = form.sectionErrorToasts[id] || 0;

    if (now - last < SECTION_ERROR_TOAST_REPEAT_MS) {
        Logger.debug(`[app][search][load-section][${id}]: повторная ошибка, тост подавлен`);
        return;
    }

    form.sectionErrorToasts[id] = now;

    toastError(error, {
        context: `[app][search][load-section][${id}]`,
        codes: [
            "INVALID_CURSOR_ID",
            "INVALID_DIRECTION",
            "INVALID_OFFSET",
            "INVALID_USER_ID",
            "USER_ID_REQUIRED"
        ],
        fallback: t("forms.search.toasts.load_error")
    });

}
