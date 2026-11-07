// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { chooseSticker } from "../functions/choose_sticker.js";

// Импортируем типы
import type { StickerPak } from "../index.js";

/**
 * ***************************************************************************
 * Действие кнопки «+»: выбор и загрузка нового стикера в пак.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function addStickerHandler(form: StickerPak): void {

    try {

        // Открываем выбор файла и цепочку загрузки (внутри — проверка лимита)
        chooseSticker(form);

    } catch (error) {
        Logger.error("[app][sticker-pak][add-sticker]:", error);
    }

}
