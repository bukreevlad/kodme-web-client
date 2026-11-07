// Импортируем config
import { MEDIA_SECTIONS } from "../../config/media_sections.js";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем events
import { subscribeChannelItemUpdated } from "./channel_item_updated.js";
import { subscribeSection } from "./subscribe_section.js";

// Импортируем типы
import type { ChannelProfile, Unsubscribe } from "../../types.js";

/**
 * ***************************************************************************
 * StoreEvents - подписки формы на события Store.
 *
 * Зачем нужен destroy: подписка на обновление канала живёт в глобальном
 * Main.store и без отписки удерживает закрытую форму в памяти — вместе с
 * ней шесть OverlayScrollbars, шесть Store и весь DOM. Отписки складываем на
 * форме и вызываем из _onBeforeClose().
 *
 * Подписки секций берутся из MEDIA_SECTIONS: раньше их было 12 файлов,
 * теперь одна функция на вкладку, вызываемая в цикле. Новая вкладка
 * получает подписки автоматически.
 ***************************************************************************
 */
export class StoreEvents {

    /**
     * ***************************************************************************
     * Подписка формы на события Store.
     * @param form - Экземпляр формы профиля канала.
     * @returns void
     ***************************************************************************
     */
    static init(form: ChannelProfile): void {

        if (!form) return;

        // Отдельно подписка на глобальный Main.store: она переживает форму
        const unsubs: (Unsubscribe | null)[] = [subscribeChannelItemUpdated(form)];

        // Подписки секций. Списков и сторов на момент init ещё нет —
        // они создаются в конструкторе формы, поэтому порядок важен:
        // init вызывается после конструктора
        for (const section of MEDIA_SECTIONS) {
            unsubs.push(subscribeSection(form, section));
        }

        // Отписки складываем в массив на форме: обходится в destroy().
        // null-ы убираем — они не дают отписаться
        form.storeUnsubs = unsubs.filter((unsub): unsub is Unsubscribe => typeof unsub === "function");

    }

    /**
     * ***************************************************************************
     * Отписка от всех событий Store.
     * @param form - Экземпляр формы профиля канала.
     * @returns void
     ***************************************************************************
     */
    static destroy(form: ChannelProfile): void {

        if (!form) return;

        // Каждую отписку оборачиваем в try/catch: ошибка одной не должна
        // мешать закрытию формы и срывать отписку остальных
        for (const unsubscribe of form.storeUnsubs || []) {
            try {
                unsubscribe();
            } catch (error) {
                Logger.error("[app][events][store-events]::destroy", error);
            }
        }

        // Чистим массив, чтобы повторный вызов был безопасен
        form.storeUnsubs = [];

    }

}
