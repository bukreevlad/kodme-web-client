// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем forms
import { StickerPakCreate } from "../../sticker-pak-create/index.js";

/**
 * ***************************************************************************
 * Открытие формы создания пака стикеров.
 * ***************************************************************************
 */
export function createPakHandler(): void {

    try {

        // Открываем форму
        new StickerPakCreate();

    } catch (error) {
        Logger.error("[app][sticker-paks][create-pak]:", error);
    }

}
