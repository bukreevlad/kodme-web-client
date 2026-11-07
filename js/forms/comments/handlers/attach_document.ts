// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getAcceptExtensions } from "../../../utils/validation/file_validator.js";

// Импортируем functions
import { importAttaches } from "../functions/import_attaches.js";

// Импортируем типы
import type { Comments } from "../index.js";

/**
 * ***************************************************************************
 * attachDocumentHandler - открыть системный диалог выбора файлов и добавить
 * их как вложения черновика комментария.
 *
 * `accept` подставляется из white-листа расширений — чистый UX: реальная
 * проверка происходит в `importAttaches` (там же отсекаются размер, mime и
 * лимит количества), потому что `accept` обходится и через drag&drop.
 * @param form - Экземпляр формы.
 * @returns Promise<void>
 * ***************************************************************************
 */
export async function attachDocumentHandler(form: Comments): Promise<void> {

    try {

        // Если нет формы
        if (!form) return;

        // Создаем инпут выбора файлов
        let input = document.createElement("input");
        input.type = "file";
        input.multiple = true;

        // Подставляем white-list расширений (чистый UX)
        input.accept = getAcceptExtensions();

        // Обработчик выбора файлов
        input.addEventListener("change", async () => {

            // Если файлы выбраны
            if (input.files?.length) {

                // Импортируем выбранные файлы
                await importAttaches(form, Array.from(input.files));

            }

        });

        // Клик — программно (инпут скрыт и не отображается)
        input.click();

    } catch (error) {
        Logger.error("[app][comments][attach-document]", error);
    }

}
