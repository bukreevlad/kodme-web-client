// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { Comments } from "../index.js";

/**
 * ***************************************************************************
 * Запустить либо отменить запись видео-кружочка (кнопка в футере).
 * В режиме записи кнопка превращается в «отмену» (X).
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function startStopVideoNoteRecordHandler(form: Comments): Promise<void> {

    try {

        // Если нет формы или рекордер не запущен
        if (!form || !form.videoNoteRecorder) return;

        // Если запись идёт — отменяем, иначе запускаем
        if (form.videoNoteRecorder?.recorder?.isRecording) {
            form.videoNoteRecorder.cancel();
        } else {
            await form.videoNoteRecorder.start();
        }

    } catch (error) {
        Logger.error(error);
    }

}
