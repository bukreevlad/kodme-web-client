// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { slideTo } from "../functions/slide_to.js";

// Импортируем типы
import type { MediaViewer } from "../index.js";

/**
 * ***************************************************************************
 * Перелистывание стрелками клавиатуры (только при нескольких медиафайлах).
 * @param event - Событие keydown.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function keydownHandler(event: KeyboardEvent, form: MediaViewer): Promise<void> {

    try {

        if (form.media.length > 1) {
            if (event.key === "ArrowLeft") await slideTo(form, "prev");
            if (event.key === "ArrowRight") await slideTo(form, "next");
        }

    } catch (error) {
        Logger.error(error);
    }

}
