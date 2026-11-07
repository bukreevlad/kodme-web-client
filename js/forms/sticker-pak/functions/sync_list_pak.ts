// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем forms
import { StickerPaks } from "../../sticker-paks/index.js";

// Импортируем типы
import type { StickerPakItem } from "../../sticker-paks/types.js";
import type { StickerPak } from "../index.js";

/**
 * ***************************************************************************
 * Синхронизация плашки пака в форме списка (`sticker-paks`).
 *
 * Форма содержимого живёт отдельно от списка: добавление/удаление стикера,
 * правка пака или новые стикеры меняют плашку списка (количество, превью,
 * флаги) через стор — событие `item::updated::<id>` перерисовывает её.
 * Если форма списка закрыта — просто выходим (список загрузится заново
 * при следующем открытии).
 *
 * @param form - Экземпляр формы содержимого пака.
 * @param patch - Функция обновления записи пака (получает актуальный item).
 * ***************************************************************************
 */
export function syncListPak(form: StickerPak, patch: (item: StickerPakItem) => StickerPakItem): void {

    try {

        // Форма списка не открыта — синхронизировать нечего
        const listForm = StickerPaks.instance;
        if (!listForm) return;

        // Записи пака может не быть (например, пак открыт из чужого списка)
        const item = listForm.store.get(form.pakId);
        if (!item) return;

        // Обновляем запись — компонент плашки перерисует её по событию
        listForm.store.update(form.pakId, patch(item));

    } catch (error) {
        Logger.error("[app][sticker-pak][sync-list-pak]:", error);
    }

}
