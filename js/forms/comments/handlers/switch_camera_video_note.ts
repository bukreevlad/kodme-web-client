// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { Comments } from "../index.js";

/**
 * ***************************************************************************
 * Сменить камеру при записи видео-кружочка.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function switchCameraVideoNoteHandler(form: Comments): Promise<void> {

    try {

        // Если нет формы или рекордер не запущен
        if (!form || !form.videoNoteRecorder) return;

        // Переключаем камеру
        form.videoNoteRecorder.switchCamera();

    } catch (error) {
        Logger.error(error);
    }

}
