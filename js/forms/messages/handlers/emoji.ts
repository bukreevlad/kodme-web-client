// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { inputInsertText } from "../../../utils/helpers/input_insert_text.js";

// Импортируем functions
import { updateStateButtons } from "../functions/update_state_buttons.js";
import { sendSticker } from "../functions/send_sticker.js";

// Импортируем forms
import { Emoji } from "../../emoji/index.js";

// Импортируем типы
import type { EmojiFocusSticker } from "../../emoji/types.js";
import type { Messages } from "../index.js";

/**
 * ***************************************************************************
 * Открыть панель эмодзи и вставить выбранный символ в поле ввода.
 * При showStickers доступен таб «Стикеры»: выбор стикера отправляет его
 * сообщением в чат (см. functions/send_sticker.ts). С focusSticker панель
 * сразу открывает сетку пака стикера и переходит к нему (см.
 * emoji/functions/show_sticker.ts).
 * @param form - Экземпляр формы.
 * @param focus - Стикер, к которому перейти при открытии (необязательно).
 * ***************************************************************************
 */
export async function emojiHandler(form: Messages, focus?: EmojiFocusSticker | null | undefined): Promise<void> {

    try {

        // Если нет формы
        if (!form) return;

        // Панель уже открыта: с фокусом переоткрываем её под текущий чат
        // (обработчики и якорь пересоздаются), без фокуса ничего не делаем
        const existing = Emoji.instance;
        if (existing) {
            if (!focus) return;
            await existing.modal?.close();
        }

        // Открываем форму emoji
        new Emoji({
            options: {
                insertInto: form.tpl,
                targetNode: form.tpl?.querySelector<HTMLElement>(":scope >.footer .wrap-footer"),
                targetNodeDirection: ["top", "left"],
                margin: [10, 0, 0, 0]
            },
            showStickers: true,
            focusSticker: focus,
            stickerCallback: (sticker) => sendSticker(form, sticker),
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
