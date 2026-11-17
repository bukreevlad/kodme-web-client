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
 * Подписки возвращают отписку: она складывается в `form.storeUnsubs`
 * и вызывается из `teardown` — иначе подписка утечёт вместе с формой.
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

            // Регистрируем DOM-копию строки в реестре стора секции
            store.registerDomElement(payload.id, item);
            const direction = hasDirection(options) ? options.direction : undefined;
            if (direction === "prev") {
                list.prepend(item);
            } else {
                list.appendChild(item);
            }

        });

        // DOM-копии строк стор снимает сам при удалении элементов
        return offAdded;

    } catch (error) {

        Logger.error(`[app][search][subscribe-section][${section.id}]:`, error);

        return () => { };

    }

}
