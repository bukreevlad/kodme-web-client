// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { slideTo } from "../functions/slide_to.js";

// Импортируем типы
import type { MediaViewer } from "../index.js";

/**
 * ***************************************************************************
 * Перелистывание на предыдущий медиафайл (кнопка «‹»).
 * @param event - Событие клика.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function prevHandler(event: MouseEvent, form: MediaViewer): Promise<void> {

    try {

        // Не даём клику дойти до оверлея (иначе закроется по фону)
        event?.stopPropagation();

        await slideTo(form, "prev");

    } catch (error) {
        Logger.error(error);
    }

}
