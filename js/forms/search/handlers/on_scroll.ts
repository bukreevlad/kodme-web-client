// Импортируем config
import { SEARCH_SCROLL_THROTTLE_MS, SEARCH_LOAD_AHEAD } from "../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { throttle } from "../../../utils/helpers/throttle.js";

// Импортируем functions
import { loadSection } from "../functions/load_section.js";

// Импортируем типы
import type { OverlayScrollbars } from "overlayscrollbars";
import type { SearchSection } from "../config/sections.js";
import type { Search } from "../index.js";

/**
 * ***************************************************************************
 * Подписка на скролл панели вкладки с догрузкой соседних страниц.
 *
 * 1. Троттлинг: OverlayScrollbars шлёт `scroll` на КАЖДЫЙ тик прокрутки,
 *    поэтому проверка не чаще раза в SEARCH_SCROLL_THROTTLE_MS.
 *
 * 2. Проверяются только края (первый и последний элементы списка) — обход
 *    всех `children` с `getBoundingClientRect` дал бы N перерасчётов
 *    раскладки на событие.
 *
 * 3. Порог края — константа SEARCH_LOAD_AHEAD.
 *
 * @param form - Экземпляр формы.
 * @param section - Описание категории (см. config/sections.ts).
 * @param scrollInstance - Инстанс OverlayScrollbars панели.
 * @returns Функция отписки либо null, если подписываться не на что.
 ***************************************************************************
 */
export function onScrollHandler(form: Search, section: SearchSection, scrollInstance: OverlayScrollbars | null): (() => void) | null {

    // Подписываться не на что
    if (!form || !scrollInstance) return null;

    const id = section.id;

    const checkEdges = () => {

        try {

            // Форма закрыта: панель уже отсоединена от документа
            if (form.isClosed) return;

            const viewport = scrollInstance.elements?.()?.viewport;
            const items = form.lists[id]?.children;
            if (!viewport || !items?.length) return;

            // Первая страница категории не применена — курсора и has_more
            // в состоянии нет: direction-запрос вернул бы не ту страницу
            // (см. functions/load_section.ts)
            if (!form.pagination[id].firstLoaded) return;

            // Раскладку viewport читаем один раз на весь проход
            const viewportRect = viewport.getBoundingClientRect();

            // Верх списка: первый элемент у верхней границы — пора грузить
            // старые записи (prev). Гард hasMorePrev в loadSection: первая
            // страница поиска начинается от глобального минимума, поэтому
            // старше обычно нечего
            // invariant: элементы списка — div'ы, вставленные формой
            const firstRect = (items[0] as HTMLElement).getBoundingClientRect();
            if (firstRect.bottom >= viewportRect.top - SEARCH_LOAD_AHEAD) {
                loadSection(form, section, { direction: "prev" });
            }

            // Низ списка: последний элемент подтягивается к нижней границе —
            // пора грузить новые записи (next)
            // invariant: элементы списка — div'ы, вставленные формой
            const lastRect = (items[items.length - 1] as HTMLElement).getBoundingClientRect();
            if (lastRect.top <= viewportRect.bottom + SEARCH_LOAD_AHEAD) {
                loadSection(form, section, { direction: "next" });
            }

        } catch (error) {

            // Фоновая проверка: тост здесь был бы шумом — пользователь ничего
            // не нажимал, скролл просто не догрузит страницу
            Logger.debug(`[app][search][on-scroll][${id}]:`, error);

        }

    };

    // leading — проверяем сразу на первом тике; trailing — дослаём последний
    // вызов после паузы, чтобы догрузка не потерялась в конце прокрутки
    const throttled = throttle(checkEdges, SEARCH_SCROLL_THROTTLE_MS, {
        leading: true,
        trailing: true
    });

    scrollInstance.on("scroll", throttled);

    // Отписка снимает и слушатель, и таймер троттлинга: иначе после закрытия
    // формы отложенный вызов «выстрелил» бы по уже удалённому DOM
    return () => {
        try {
            scrollInstance.off("scroll", throttled);
        } catch (error) {
            Logger.debug(`[app][search][on-scroll][${id}]::off`, error);
        }
        throttled.cancel();
    };

}
