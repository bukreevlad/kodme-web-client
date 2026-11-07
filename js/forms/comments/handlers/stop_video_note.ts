// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { Comments } from "../index.js";

/**
 * ***************************************************************************
 * Остановить запись видео-кружочка (кнопка стоп; кружок ложится в черновик).
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function stopVideoNoteHandler(form: Comments): Promise<void> {

    try {

        // Если нет формы или рекордер не запущен
        if (!form || !form.videoNoteRecorder) return;

        // Останавливаем запись и отправляем
        await form.videoNoteRecorder.stop();

    } catch (error) {
        Logger.error(error);
    }

}
