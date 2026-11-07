// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем типы
import type { SearchSection } from "../../config/sections.js";
import type { SearchRecord } from "../../types.js";
import { hasDirection, isSearchRecord } from "../../types.js";
import type { Search } from "../../index.js";

/**
 * Фабрика строки списка одной категории: принимает форму и запись,
 * возвращает готовый DOM-элемент (см. components/*).
 */
export type ItemFactory = (form: Search, data: SearchRecord) => HTMLElement;

/**
 * ***************************************************************************
 * Подписки стора одной категории поиска на добавление и удаление элементов.
 *
 * Замена восьми файлов (`*_item_added.js` / `*_item_removed.js`), которые
 * различались стором, списком и классом строки.
 *
 * Отличие от прежней реализации — подписки возвращают отписку. Раньше
 * `events/store/index.ts` только вызывал `init` и ничего не отписывал: стороны
 * принадлежат форме, поэтому сегодня это безопасно, но как только появится
 * подписка не на стор формы (онлайн-статусы, `Main.store`), получилась бы
 * ровно та утечка, что была в профиле канала. Отписка складывается в
 * `form.storeUnsubs` и вызывается из `teardown`.
 *
 * @param form - Экземпляр формы.
 * @param section - Описание категории (см. config/sections.ts).
 * @param createItem - Фабрика строки списка категории.
 * @returns Функция, снимающая обе подписки.
 ***************************************************************************
 */
export function subscribeSection(form: Search, section: SearchSection, createItem: ItemFactory): () => void {

    if (!form || !section || !createItem) return () => { };

    const store = form.stores[section.id];
    if (!store) return () => { };

    try {

        // Добавление: стор сам раздаёт элементы подписчикам.
        // Список ищем В МОМЕНТ СОБЫТИЯ, а не при подписке: подписка создаётся
        // в _init, а списки появляются позже, в _onBeforeOpen
        const offAdded = store.on("item::added", (payload, options) => {

            // Форма закрыта, пока летел ответ: DOM уже удалён
            if (form.isClosed) return;

            // Запись без id не должна ронять весь ответ (см. first_loaded)
            if (!isSearchRecord(payload)) return;

            const list = form.lists[section.id];
            if (!list) return;

            // Направление: пачка prev (сервер отдаёт её по убыванию id)
            // вставляется в начало — последовательный prepend складывает
            // её в возрастающем порядке, старые записи остаются сверху
            const item = createItem(form, payload);
            const direction = hasDirection(options) ? options.direction : undefined;
            if (direction === "prev") {
                list.prepend(item);
            } else {
                list.appendChild(item);
            }

        });

        // Удаление: у записи может быть несколько копий элемента
        const offRemoved = store.on("item::removed", (payload) => {

            if (!isSearchRecord(payload)) return;

            const elements = payload.__domElements__;
            if (!Array.isArray(elements)) return;

            for (const element of elements) {
                if (element && typeof element.remove === "function") element.remove();
            }

            Logger.debug(`[app][search][${section.id}]: удалено копий — ${elements.length}`);

            // Очищаем массив, чтобы не копить утечки памяти
            payload.__domElements__ = [];

        });

        return () => {
            offAdded();
            offRemoved();
        };

    } catch (error) {

        Logger.error(`[app][search][subscribe-section][${section.id}]:`, error);

        return () => { };

    }

}
