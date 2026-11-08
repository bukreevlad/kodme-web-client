// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем forms
import { Main } from "../../../main/index.js";

// Импортируем requests (тип ответа get info — тот же объект канала)
import type { ChannelProfileResponse } from "../../requests/get_channel_info.js";

// Импортируем типы
import type { ChannelProfile, Unsubscribe } from "../../types.js";

/**
 * ***************************************************************************
 * Подписка на обновление канала.
 *
 * Главный источник утечки формы: Main.store живёт всё время работы приложения,
 * поэтому подписка без отписки удерживает форму (а через неё — 6
 * OverlayScrollbars, 6 Store и весь DOM) НАВСЕГДА, а не до закрытия профиля.
 * Каждое открытие профиля добавляло ещё одну такую подписку.
 *
 * @param form - Экземпляр формы.
 * @returns Функция отписки от события Main.store или null.
 * ***************************************************************************
 */
export function subscribeChannelItemUpdated(form: ChannelProfile): Unsubscribe | null {

    // Если форма не открыта или канал не определён — подписываться не на что
    if (!form || !form.channelId) return null;

    // Синглтон главной формы — источник подписки; без него отписываться не на что
    const store = Main.instance?.store;
    if (!store) return null;

    try {

        // Подписываемся на событие обновления канала; возвращаемую отписку
        // сохраняет StoreEvents — без неё подписка в Main.store не снимется
        // invariant: контракт подписки Store — payload: unknown
        return store.on(`item::updated::${form.channelId}`, (data: unknown) => {

            // Store.update() эмитит событие даже если элемента нет в Map —
            // в этом случае data === undefined, а _update рассчитан на объект
            if (!data) return;

            // Вызываем обновление формы.
            // Именно update(), а не _update(): публичный метод ловит исключения,
            // а Store.emit не изолирует слушателей — упавший обработчик
            // прервал бы эмиссию для всех остальных подписчиков события.
            // invariant: Main.store хранит объекты каналов — тот же контракт,
            // что и ответ запроса информации о канале
            form.update(data as ChannelProfileResponse);

        });

    } catch (error) {
        Logger.error("[app][events][channel-item-updated]:", error);
        return null;
    }

}
