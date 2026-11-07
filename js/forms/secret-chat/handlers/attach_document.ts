// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { getAcceptExtensions } from "../../../utils/validation/file_validator.js";

// Импортируем functions
import { importAttaches } from "../functions/import_attaches.js";

// Импортируем типы
import type { SecretChat } from "../index.js";

/**
 * ***************************************************************************
 * Открыть системный диалог выбора файлов и добавить их как вложения.
 *
 * `accept` подставляется из white-листа расширений — чистый UX: реальная
 * проверка происходит в `ImportAttaches` (там же отсекаются размер, mime и
 * лимит количества), потому что `accept` обходится и через drag&drop.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function attachDocumentHandler(form: SecretChat): Promise<void> {

    try {

        // Если нет формы
        if (!form) return;

        // Создаем инпут выбора файлов
        let input = document.createElement("input");
        input.setAttribute("multiple", "true");
        input.type = "file";

        // Разрешённые расширения (зеркало серверного white-листа)
        input.setAttribute("accept", getAcceptExtensions());

        // Действие выбора файлов (берём файлы из самого input: у EventTarget нет files)
        input.onchange = async () => {
            if (input.files) await importAttaches(form, Array.from(input.files));
        }

        // Открываем диалог выбора файлов
        input.click();

    } catch (error) {
        Logger.error("[app][secret-chat][attach-document]:", error);
    }

}
