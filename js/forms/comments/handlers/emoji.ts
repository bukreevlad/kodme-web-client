// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { inputInsertText } from "../../../utils/helpers/input_insert_text.js";

// Импортируем functions
import { updateStateButtons } from "../functions/update_state_buttons.js";

// Импортируем forms
import { Emoji } from "../../emoji/index.js";

// Импортируем типы
import type { Comments } from "../index.js";

/**
 * ***************************************************************************
 * Открыть панель эмодзи и вставить выбранный символ в поле ввода.
 * @param form - Экземпляр формы.
 * @returns Promise<void>
 * ***************************************************************************
 */
export async function emojiHandler(form: Comments): Promise<void> {

    try {

        // Если нет формы
        if (!form) return;

        // Открываем форму emoji
        new Emoji({
            options: {
                insertInto: form.tpl,
                targetNode: form.tpl?.querySelector<HTMLElement>(":scope >.footer .wrap-footer"),
                targetNodeDirection: ["top", "left"],
                margin: [10, 0, 0, 0]
            },
            callback: (item) => {

                // Вставляем emoji (нет поля ввода — вставлять некуда)
                if (form.textarea) inputInsertText(form.textarea, item.emoji);

                // Обновляем состояние кнопок
                updateStateButtons(form);

                // Обновляем высоту текстового поля
                if (form.textareaAutosize) {

                    // Ожидаем отрисовку 1 кадра
                    requestAnimationFrame(() => {
                        form.textareaAutosize?.update();
                    });

                }

            }
        });

    } catch (error) {
        Logger.error("[app][comments][emoji]", error);
    }

}
