// Импортируем config
import { CHANNEL_PROFILE_SCROLL_THROTTLE_MS, CHANNEL_PROFILE_LOAD_AHEAD } from "../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { throttle } from "../../../utils/helpers/throttle.js";

// Импортируем functions
import { loadSection } from "../functions/load_section.js";

// Импортируем типы
import type { ChannelProfile, MediaSection, Unsubscribe } from "../types.js";
import type { OverlayScrollbars } from "overlayscrollbars";

/**
 * ***************************************************************************
 * Подписка на скролл панели вкладки с догрузкой соседних страниц.
 *
 * Замена шести обработчиков on_*_scroll.js, которые различались именем
 * функции загрузки. Отличия от прежней реализации:
 *
 * 1. Троттлинг. OverlayScrollbars шлёт scroll на КАЖДЫЙ тик прокрутки —
 *    десятки раз в секунду. Теперь проверка не чаще раза в
 *    CHANNEL_PROFILE_SCROLL_THROTTLE_MS.
 *
 * 2. Проверяются только края, а не все элементы. Вопрос «пора ли грузить»
 *    зависит только от первой и последней записей списка (разделители
 *    месяцев data-month не участвуют), а обход всех children с
 *    getBoundingClientRect давал N принудительных перерасчётов раскладки на
 *    событие (для сотни фото — сто). Считаем 2.
 *
 * Порог догрузки задаётся константой: элемент считается «за экраном», если
 * он дальше CHANNEL_PROFILE_LOAD_AHEAD от видимой области. Раньше порог был
 * зашит числом 15 в каждом из шести файлов.
 *
 * @param form - Экземпляр формы.
 * @param section - Описание секции (см. config/media_sections.ts).
 * @param scrollInstance - Экземпляр OverlayScrollbars панели.
 * @returns Функция отписки или null.
 ***************************************************************************
 */
export function onSectionScrollHandler(
    form: ChannelProfile,
    section: MediaSection,
    scrollInstance: OverlayScrollbars | null
): Unsubscribe | null {

    // Без формы, секции или скроллбара подписываться не на что
    if (!form || !section || !scrollInstance) return null;

    const checkEdges = () => {

        try {

            const viewport = scrollInstance.elements?.()?.viewport;
            const items = form[section.listKey]?.children;
            if (!viewport || !items?.length) return;

            // Первая страница секции не загружена — границ курсора в
            // состоянии секции нет: запрос с direction вернул бы не ту
            // страницу (см. functions/load_section.ts)
            if (!form[`${section.id}FirstLoaded`]) return;

            // Раскладку viewport читаем один раз на весь проход
            const viewportRect = viewport.getBoundingClientRect();

            // Крайние строки: разделители месяцев (data-month) в проверке
            // краёв не участвуют — меряем только строки записей
            let first: Element | undefined;
            let last: Element | undefined;
            for (const item of Array.from(items)) {
                if (item.hasAttribute("data-month")) continue;
                first ??= item;
                last = item;
            }
            if (!first || !last) return;

            // Верх списка: первая строка у верхней границы — пора грузить
            // новые (next). Гард hasMoreNext в loadSection: первая страница
            // открывается от глобального максимума, новее обычно нечего
            const firstRect = first.getBoundingClientRect();
            if (firstRect.bottom >= viewportRect.top - CHANNEL_PROFILE_LOAD_AHEAD) {
                loadSection(form, section, { direction: "next" });
            }

            // Низ списка: последняя строка подтягивается к нижней границе —
            // пора грузить старые (prev). Раньше проверка была инвертирована
            // (lastRect.top >= bottom - AHEAD): для списка выше viewport
            // условие истинно в ЛЮБОЙ позиции скролла, и догрузка срабатывала
            // на каждом тике
            const lastRect = last.getBoundingClientRect();
            if (lastRect.top <= viewportRect.bottom + CHANNEL_PROFILE_LOAD_AHEAD) {
                loadSection(form, section, { direction: "prev" });
            }

        } catch (error) {

            // Фоновая проверка: тост здесь был бы шумом — пользователь ничего
            // не нажимал, скролл просто не догрузит страницу
            Logger.debug(`[app][channel-profile][on-section-scroll][${section.id}]:`, error);

        }

    };

    // leading — проверяем сразу на первом тике; trailing — дослаём последний
    // вызов после паузы, чтобы догрузка не потерялась в конце прокрутки
    const throttled = throttle(checkEdges, CHANNEL_PROFILE_SCROLL_THROTTLE_MS, {
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
            Logger.debug(`[app][channel-profile][on-section-scroll][${section.id}]::off`, error);
        }
        throttled.cancel();
    };

}
