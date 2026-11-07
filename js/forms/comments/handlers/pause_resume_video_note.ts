// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { Comments } from "../index.js";

/**
 * ***************************************************************************
 * Переключить паузу/продолжение записи видео-кружочка.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function pauseResumeVideoNoteHandler(form: Comments): Promise<void> {

    try {

        // Если нет формы или рекордер не запущен
        if (!form || !form.videoNoteRecorder) return;

        // Переключаем паузу (иконка обновится в самой сессии)
        form.videoNoteRecorder.togglePause();

    } catch (error) {
        Logger.error(error);
    }

}
