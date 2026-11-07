// Импортируем config
import { CONTACTS_SCROLL_THROTTLE_MS, CONTACTS_LOAD_AHEAD_PX } from "../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { throttle } from "../../../utils/helpers/throttle.js";

// Импортируем functions
import { getContacts } from "../functions/get_contacts.js";

// Импортируем типы
import type { OverlayScrollbars } from "overlayscrollbars";
import type { Contacts } from "../index.js";

/**
 * ***************************************************************************
 * Подписка на скролл списка контактов с догрузкой страниц.
 *
 * Список «старые сверху, новые снизу», поэтому направления зеркальны
 * трансляциям:
 * - у ВЕРХНЕЙ границы (первый элемент у боковой границы) — подгружаем
 *   СТАРЫЕ записи (prev, вставка в начало);
 * - у НИЖНЕЙ границы (последний элемент подтягивается к низу) —
 *   подгружаем НОВЫЕ записи (next, вставка в конец).
 *
 * Отличия от прежнего обработчика (см. broadcasts/on_casts_scroll):
 *
 * 1. Троттлинг: OverlayScrollbars шлёт scroll на КАЖДЫЙ тик прокрутки —
 *    десятки раз в секунду. Проверка не чаще раза в
 *    CONTACTS_SCROLL_THROTTLE_MS.
 *
 * 2. Проверяются только края, а не все элементы: вопрос «пора ли грузить»
 *    зависит только от первого и последнего элементов списка, а обход всех
 *    children с getBoundingClientRect давал N принудительных перерасчётов
 *    раскладки на событие. Считаем 2.
 *
 * @param form - Экземпляр формы.
 * @param scrollInstance - Экземпляр OverlayScrollbars панели.
 * @returns Функция отписки либо null, если подписываться не на что.
 ***************************************************************************
 */
export function onContactsScrollHandler(form: Contacts, scrollInstance: OverlayScrollbars | null): (() => void) | null {

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
            // старые записи (prev)
            // invariant: элементы списка — div'ы, вставленные формой
            const firstRect = (items[0] as HTMLElement).getBoundingClientRect();
            if (firstRect.bottom >= viewportRect.top - CONTACTS_LOAD_AHEAD_PX) {
                getContacts(form, { direction: "prev" });
            }

            // Низ списка: последний элемент подтягивается к нижней границе —
            // пора грузить новые записи (next)
            // invariant: элементы списка — div'ы, вставленные формой
            const lastRect = (items[items.length - 1] as HTMLElement).getBoundingClientRect();
            if (lastRect.top <= viewportRect.bottom + CONTACTS_LOAD_AHEAD_PX) {
                getContacts(form, { direction: "next" });
            }

        } catch (error) {

            // Фоновая проверка: тост здесь был бы шумом — пользователь ничего
            // не нажимал, скролл просто не догрузит страницу
            Logger.debug(`[app][contacts][on-contacts-scroll]:`, error);

        }

    };

    // leading — проверяем сразу на первом тике; trailing — дослаём последний
    // вызов после паузы, чтобы догрузка не потерялась в конце прокрутки
    const throttled = throttle(checkEdges, CONTACTS_SCROLL_THROTTLE_MS, {
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
            Logger.debug(`[app][contacts][on-contacts-scroll]::off`, error);
        }
        throttled.cancel();
    };

}
