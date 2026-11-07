// Импортируем config
import { MAIN_FOLDERS_SCROLL_THROTTLE_MS, MAIN_FOLDERS_LOAD_AHEAD_PX } from "../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { throttle } from "../../../utils/helpers/throttle.js";

// Импортируем functions
import { getFolders } from "../functions/get_folders.js";

// Импортируем типы
import type { OverlayScrollbars } from "overlayscrollbars";
import type { MainFoldersManager } from "../index.js";

/**
 * ***************************************************************************
 * Подписка на скролл списка папок с догрузкой страниц.
 *
 * Список «старые сверху, новые снизу», поэтому направления зеркальны
 * трансляциям:
 * - у ВЕРХНЕЙ границы (первый элемент у боковой границы) — подгружаем
 *   СТАРЫЕ папки (prev, вставка в начало);
 * - у НИЖНЕЙ границы (последний элемент подтягивается к низу) —
 *   подгружаем НОВЫЕ папки (next, вставка в конец).
 *
 * Раньше форма грузила одну страницу без подгрузки вовсе — обработчик
 * скролла появился вместе с direction-пагинацией (см.
 * group-topics-manager/on_topics_scroll как эталон):
 *
 * 1. Троттлинг: OverlayScrollbars шлёт scroll на КАЖДЫЙ тик прокрутки —
 *    десятки раз в секунду. Проверка не чаще раза в
 *    MAIN_FOLDERS_SCROLL_THROTTLE_MS.
 *
 * 2. Проверяются только края, а не все элементы: вопрос «пора ли грузить»
 *    зависит только от первого и последнего элементов, а обход всех children
 *    с getBoundingClientRect давал N принудительных перерасчётов раскладки
 *    на событие. Считаем 2.
 *
 * @param form - Экземпляр формы.
 * @param scrollInstance - Экземпляр OverlayScrollbars панели.
 * @returns Функция отписки либо null, если подписываться не на что.
 * ***************************************************************************
 */
export function onFoldersScrollHandler(
    form: MainFoldersManager,
    scrollInstance: OverlayScrollbars | null
): (() => void) | null {

    // Без формы или скроллбара подписываться не на что
    if (!form || !scrollInstance) return null;

    const checkEdges = () => {

        try {

            const viewport = scrollInstance.elements?.()?.viewport;
            const items = form.list?.children;
            if (!viewport || !items?.length) return;

            // Первая страница не загружена — курсоров в сторе нет:
            // запрос с direction при пустом сторе вернул бы не ту страницу
            if (!form.isFirstLoaded) return;

            // Раскладку viewport читаем один раз на весь проход
            const viewportRect = viewport.getBoundingClientRect();

            // Верх списка: первый элемент у верхней границы — пора грузить
            // старые папки (prev)
            const first = items[0];
            if (!first) return;
            const firstRect = first.getBoundingClientRect();
            if (firstRect.bottom >= viewportRect.top - MAIN_FOLDERS_LOAD_AHEAD_PX) {
                getFolders(form, { direction: "prev" });
            }

            // Низ списка: последний элемент подтягивается к нижней границе —
            // пора грузить новые папки (next)
            const last = items[items.length - 1];
            if (!last) return;
            const lastRect = last.getBoundingClientRect();
            if (lastRect.top <= viewportRect.bottom + MAIN_FOLDERS_LOAD_AHEAD_PX) {
                getFolders(form, { direction: "next" });
            }

        } catch (error) {

            // Фоновая проверка: тост здесь был бы шумом — пользователь ничего
            // не нажимал, скролл просто не догрузит страницу
            Logger.debug(`[app][main-folders-manager][on-folders-scroll]:`, error);

        }

    };

    // leading — проверяем сразу на первом тике; trailing — дослаём последний
    // вызов после паузы, чтобы догрузка не потерялась в конце прокрутки
    const throttled = throttle(checkEdges, MAIN_FOLDERS_SCROLL_THROTTLE_MS, {
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
            Logger.debug(`[app][main-folders-manager][on-folders-scroll]::off`, error);
        }
        throttled.cancel();
    };

}