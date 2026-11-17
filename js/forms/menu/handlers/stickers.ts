// Импортируем utils
import { FormsRegistry } from "../../../core/managers/forms_registry.js";
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем forms
import { StickerPaks } from "../../sticker-paks/index.js";

// Импортируем типы
import type { Menu } from "../index.js";

/**
 * ***************************************************************************
 * Открытие формы со стикер-паками.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function stickersHandler(form: Menu): void {

    try {

        // Открываем форму
        if (FormsRegistry.getOwner<StickerPaks>("sticker-paks")) {
            FormsRegistry.getOwner<StickerPaks>("sticker-paks")?.modal?.activate();
        } else {
            new StickerPaks();
        }

        // Закрываем меню
        form.modal?.close();

    } catch (error) {
        Logger.error(error);
    }

}
