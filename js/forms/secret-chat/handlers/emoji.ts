// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { inputInsertText } from "../../../utils/helpers/input_insert_text.js";

// Импортируем functions
import { updateStateButtons } from "../functions/update_state_buttons.js";
import { sendSticker } from "../functions/send_sticker.js";

// Импортируем forms
import { Emoji } from "../../emoji/index.js";

// Импортируем типы
import type { StickerItem } from "../../sticker-pak/types.js";
import type { SecretChat } from "../index.js";

/**
 * ***************************************************************************
 * Открыть панель эмодзи и вставить выбранный символ в поле ввода.
 * Вкладка «Стикеры» доступна: стикер скачивается blob'ом и уходит файлом
 * (см. functions/send_sticker.ts) — от серверных паков не зависит.
 * @param form - Экземпляр формы.
 * @returns Promise, завершающийся после открытия панели.
 * ***************************************************************************
 */
export async function emojiHandler(form: SecretChat): Promise<void> {

    try {

        // Если нет формы
        if (!form) return;

        // Панель уже открыта — ничего не делаем
        const existing = Emoji.instance;
        if (existing) return;

        // Открываем форму emoji
        new Emoji({
            options: {
                insertInto: form.tpl,
                targetNode: form.tpl?.querySelector<HTMLElement>(":scope >.footer .wrap-footer"),
                targetNodeDirection: ["top", "left"],
                margin: [10, 0, 0, 0]
            },
            showStickers: true,
            stickerCallback: (sticker: StickerItem) => {
                sendSticker(form, sticker);
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
        Logger.error(error);
    }

}
