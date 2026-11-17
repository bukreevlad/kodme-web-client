// Импортируем сторонние пакеты
import type { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { MEMBERS_SCROLL_THROTTLE_MS, MEMBERS_LOAD_AHEAD_PX } from "../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { throttle } from "../../../utils/helpers/throttle.js";

// Импортируем functions
import { getMembers } from "../functions/get_members.js";

// Импортируем типы
import type { ChannelMembers } from "../index.js";

/**
 * ***************************************************************************
 * Подписка на скролл списка участников с догрузкой страниц.
 *
 * Список «старые сверху, новые снизу»:
 * - у ВЕРХНЕЙ границы — подгружаем СТАРЫЕ записи (prev, вставка в начало);
 * - у НИЖНЕЙ границы — подгружаем НОВЫЕ записи (next, вставка в конец).
 *
 * Троттлинг: OverlayScrollbars шлёт scroll на каждый тик прокрутки.
 * Проверяются только первый и последний элементы — обход всех children
 * с getBoundingClientRect давал бы N перерасчётов раскладки на событие.
 *
 * @param form - Экземпляр формы.
 * @param scrollInstance - Экземпляр OverlayScrollbars панели.
 * @returns Функция отписки или null без формы/скроллбара.
 * ***************************************************************************
 */
export function onMembersScrollHandler(form: ChannelMembers, scrollInstance: OverlayScrollbars | null): (() => void) | null {

    // Без формы или скроллбара подписываться не на что
    if (!form || !scrollInstance) return null;

    const checkEdges = (): void => {

        try {

            const viewport = scrollInstance.elements?.()?.viewport;
            const items = form.list?.children;
            if (!viewport || !items?.length) return;

            // Первая страница не загружена — курсоров в сторе нет
            if (!form.isFirstLoaded) return;

            // Раскладку viewport читаем один раз на весь проход
            const viewportRect = viewport.getBoundingClientRect();

            // Верх списка: первый элемент у верхней границы — старые записи (prev)
            const first = items[0];
            if (!first) return;
            const firstRect = first.getBoundingClientRect();
            if (firstRect.bottom >= viewportRect.top - MEMBERS_LOAD_AHEAD_PX) {
                getMembers(form, { direction: "prev" });
            }

            // Низ списка: последний элемент подтягивается к нижней границе — новые (next)
            const last = items[items.length - 1];
            if (!last) return;
            const lastRect = last.getBoundingClientRect();
            if (lastRect.top <= viewportRect.bottom + MEMBERS_LOAD_AHEAD_PX) {
                getMembers(form, { direction: "next" });
            }

        } catch (error) {

            // Фоновая проверка: тост здесь был бы шумом — пользователь ничего
            // не нажимал, скролл просто не догрузит страницу
            Logger.debug(`[app][channel-members][on-scroll]:`, error);

        }

    };

    // leading — проверяем сразу на первом тике; trailing — дослаём последний
    // вызов после паузы, чтобы догрузка не потерялась в конце прокрутки
    const throttled = throttle(checkEdges, MEMBERS_SCROLL_THROTTLE_MS, {
        leading: true,
        trailing: true
    });

    scrollInstance.on("scroll", throttled);

    // Отписка снимает и слушатель, и таймер троттлинга
    return () => {
        try {
            scrollInstance.off("scroll", throttled);
        } catch (error) {
            Logger.debug(`[app][channel-members][on-scroll]::off`, error);
        }
        throttled.cancel();
    };

}
