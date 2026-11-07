// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем forms
import { StickerPak } from "../../sticker-pak/index.js";

/**
 * ***************************************************************************
 * Открытие формы содержимого пака стикеров.
 * @param pakId - Id пака.
 * ***************************************************************************
 */
export function openPakHandler(pakId: string): void {

    try {

        // Открываем форму
        new StickerPak({ pakId });

    } catch (error) {
        Logger.error("[app][sticker-paks][open-pak]:", error);
    }

}
