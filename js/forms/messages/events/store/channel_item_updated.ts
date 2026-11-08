// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем forms
import { Main } from "../../../main/index.js";

// Импортируем типы
import { isChannelRecord } from "../../types.js";
import type { Messages } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на событие обновления канала в Store главного экрана.
 *
 * @param form - Экземпляр формы.
 * @returns Функция отписки от события Main.store либо null.
 * ***************************************************************************
 */
export function subscribeChannelItemUpdated(form: Messages): (() => void) | null {

    // Если форма не открыта или канал не определён — подписываться не на что
    if (!form || !form.channelId) return null;

    // Синглтон главной формы — источник подписки; без него отписываться не на что
    const store = Main.instance?.store;
    if (!store) return null;

    try {

        // Подписываемся на событие обновления канала.
        // Возвращаемую отписку сохраняем на форме — иначе подписка
        // в Main.store утечёт вместе с закрытым чатом
        return store.on(`item::updated::${form.channelId}`, (data: unknown) => {

            // Store.update() эмитит событие даже если элемента нет в Map —
            // в этом случае data === undefined, а _update рассчитан на объект.
            if (!isChannelRecord(data)) return;

            // Вызываем обновление формы
            form._update(data);

        });

    } catch (error) {
        Logger.error("[app][events][channel-item-updated]:", error);
        return null;
    }

}
