// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { createChannelItem } from "../../components/channel.js";
import { createGroupItem } from "../../components/groups.js";
import { createUserItem } from "../../components/users.js";
import { createBotItem } from "../../components/bots.js";

// Импортируем config формы
import { SECTION_IDS, SECTIONS } from "../../config/sections.js";

// Импортируем events
import { subscribeSection } from "./subscribe_section.js";

// Импортируем типы
import type { SectionId } from "../../config/sections.js";
import type { ItemFactory } from "./subscribe_section.js";
import type { Search } from "../../index.js";

/**
 * ***************************************************************************
 * Фабрики строк списка по категориям.
 *
 * Замена восьми файлов `*_item_added.js` / `*_item_removed.js`: раньше каждая
 * категория описывалась отдельной парой файлов, отличавшихся стором, списком и
 * классом строки.
 ***************************************************************************
 */
const ITEM_FACTORIES: Record<SectionId, ItemFactory> = {
    channels: createChannelItem,
    groups: createGroupItem,
    users: createUserItem,
    bots: createBotItem
};

/**
 * ***************************************************************************
 * StoreEvents - подписки стор формы поиска.
 ***************************************************************************
 */
export class StoreEvents {

    /**
     * ***************************************************************************
     * Подписывает сторы формы на события item::added / item::removed.
     *
     * Отписки складываются в `form.storeUnsubs` — единая точка выхода
     * вызывается из `functions/teardown.ts`.
     *
     * @param form - Экземпляр формы.
     * @returns Массив отписок.
     ***************************************************************************
     */
    static init(form: Search): Array<() => void> {

        if (!form) return [];

        const unsubs: Array<() => void> = [];

        // Набор категорий и фабрик строк задан типом (Record<SectionId, …>),
        // поэтому «категории без строки» здесь уже быть не может
        for (const id of SECTION_IDS) {

            try {

                unsubs.push(subscribeSection(form, SECTIONS[id], ITEM_FACTORIES[id]));

            } catch (error) {

                // Одна упавшая категория не должна отнимать подписки остальных
                Logger.error(`[app][search][store-events][${id}]:`, error);

            }

        }

        form.storeUnsubs = unsubs;

        return unsubs;

    }

    /**
     * ***************************************************************************
     * Снимает все подписки, установленные `init`.
     * @param form - Экземпляр формы.
     ***************************************************************************
     */
    static destroy(form: Search): void {

        const unsubs = form?.storeUnsubs || [];
        form.storeUnsubs = [];

        for (const unsub of unsubs) {
            try {
                unsub();
            } catch (error) {
                Logger.error("[app][search][store-events]::destroy:", error);
            }
        }

    }

}
