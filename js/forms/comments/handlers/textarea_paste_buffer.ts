// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { importAttaches } from "../functions/import_attaches.js";

// Импортируем типы
import type { Comments } from "../index.js";

/**
 * ***************************************************************************
 * textareaPasteBufferHandler - вставить текст/файлы из буфера обмена в поле.
 * @param event - Событие вставки.
 * @param form - Экземпляр формы.
 * @returns Promise<void>
 * ***************************************************************************
 */
export async function textareaPasteBufferHandler(event: ClipboardEvent, form: Comments): Promise<void> {

    try {

        // Если нет формы
        if (!form) return;

        // Текст
        let text = event.clipboardData?.getData("text");

        // Если присутствуют файлы (clipboardData может отсутствовать — тогда
        // files undefined и вставлять/гасить нечего)
        let files = event.clipboardData?.files;
        if (files && files.length > 0) importAttaches(form, Array.from(files));

        // Если нет текста и файлов
        if (!text && files && files.length === 0) event.preventDefault();

    } catch (error) {
        Logger.error("[app][comments][paste-buffer]", error);
    }

}
