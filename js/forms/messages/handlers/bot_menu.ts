// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { updateStateButtons } from "../functions/update_state_buttons.js";

// Импортируем forms
import { BotMenu } from "../../bot-menu/index.js";

// Импортируем типы
import type { Messages } from "../index.js";

/**
 * ***************************************************************************
 * Открыть меню команд бота и вставить выбранную команду в поле ввода.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function botMenuHandler(form: Messages): Promise<void> {

    try {

        // Если нет формы
        if (!form) return;

        // Меню команд бота имеет смысл только при ботах канала
        if (!form.channel?.bots) return;

        // Открываем форму botMenu
        new BotMenu({
            bots: form.channel.bots,
            options: {
                insertInto: form.tpl,
                targetNode: form.tpl?.querySelector<HTMLElement>(":scope >.footer .wrap-footer"),
                targetNodeDirection: ["top", "left"],
                overlay: false,
                margin: [10, 0, 0, 0]
            },
            callback: (command) => {

                // Устанавливаем текст в поле
                if (form.textarea) form.textarea.value = command.command ?? "";

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
        Logger.error(error);
    }

}
