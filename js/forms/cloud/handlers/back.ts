// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { getFolder } from "../functions/get_folder.js";

// Импортируем типы
import type { Cloud } from "../index.js";

/**
 * ***************************************************************************
 * Назад: возврат в родительскую папку / из общего доступа или закрытие формы.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function backHandler(form: Cloud): Promise<void> {

    try {

        // ---------- РЕЖИМ ОБЩЕГО ДОСТУПА ----------
        if (form.mode === "shared") {

            // Если есть стек навигации — выходим в родительскую папку
            if (form.sharedPath.length > 0) {
                _backShared(form);
            } else {

                // Возвращаемся в «Доступное для меня»
                form._setMode("available");

            }

            return;

        }

        // ---------- РЕЖИМ «МОЁ ОБЛАКО» ----------
        if (form.mode === "mine" && form.folderStack.length > 0) {

            // Выходим в родительскую папку
            _backMine(form);

            return;

        }

        // ---------- РЕЖИМ «ДОСТУПНОЕ ДЛЯ МЕНЯ» ----------
        if (form.mode === "available") {

            // Возвращаемся в «Моё облако» (форма не закрывается)
            form._setMode("mine");
            return;

        }

        // ---------- КОРЕНЬ «МОЁ ОБЛАКО» ----------
        form.modal?.close();

    } catch (error) {
        Logger.error(error);
    }

}

/**
 * ***************************************************************************
 * Возврат на шаг назад в своём облаке.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
async function _backMine(form: Cloud): Promise<void> {

    // Убираем текущую папку из стека
    form.folderStack.pop();

    // Определяем родительскую папку (или корень)
    let prev = form.folderStack[form.folderStack.length - 1];
    form.currentFolderId = prev ? prev.id : null;

    // Загружаем содержимое
    await getFolder(form);

    // Обновляем заголовок и пустые состояния
    form._renderHeader();
    form._updateEmptyStates();

}

/**
 * ***************************************************************************
 * Возврат на шаг назад в общем доступе (по ссылке).
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
async function _backShared(form: Cloud): Promise<void> {

    // Убираем текущую папку из стека
    form.sharedPath.pop();

    // Определяем родительскую папку (или корень ссылки)
    let prev = form.sharedPath[form.sharedPath.length - 1];
    form.sharedFolderId = prev ? prev.id : null;

    // Загружаем содержимое
    await getFolder(form, { shared: true });

    // Обновляем заголовок и пустые состояния
    form._renderHeader();
    form._updateEmptyStates();

}
