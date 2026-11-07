// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { createStickerPakItem } from "../../components/pack_item.js";

// Импортируем типы
import { isStickerPakItem } from "../../types.js";
import type { StickerPaks } from "../../index.js";

/**
 * ***************************************************************************
 * event: Обработка добавления пака в UI.
 *
 * Пагинация паков — offset-подгрузка «вниз», поэтому каждая новая запись
 * встаёт в КОНЕЦ списка (prepend пакам не нужен).
 *
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeItemAdded(form: StickerPaks): void {

    // Если форма не открыта
    if (!form) return;

    try {

        // Подписываемся
        form.store.on("item::added", (data) => {

            // Стор шлёт payload как unknown — сверяемся guard'ом
            if (!isStickerPakItem(data)) return;

            try {

                // Создаём элемент списка и вставляем в конец
                const element = createStickerPakItem(form, data);
                if (element) form.list?.appendChild(element);

            } catch (error) {
                Logger.error("[app][sticker-paks][item-added]:", error);
            }

        });

    } catch (error) {
        Logger.error("[app][sticker-paks][subscribe-item-added]:", error);
    }

}
