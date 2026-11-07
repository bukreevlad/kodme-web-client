// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { IsMobile } from "../../../utils/helpers/is_mobile.js";

// Импортируем handlers
import { createCommentHandler } from "./create_comment.js";
import { updateCommentHandler } from "./update_comment.js";

// Импортируем functions
import { updateStateButtons } from "../functions/update_state_buttons.js";

// Импортируем типы
import type { Comments } from "../index.js";

/**
 * Событие ввода в textarea: клавиатура (keydown) либо вставка текста (input).
 */
type TextareaInputEvent = KeyboardEvent | InputEvent;

/**
 * ***************************************************************************
 * Определить, что событие — клавиатурное (есть клавиша).
 * @param event - Событие ввода.
 * @returns true, если это KeyboardEvent.
 * ***************************************************************************
 */
function isKeyboardEvent(event: TextareaInputEvent): event is KeyboardEvent {
    return "key" in event;
}

/**
 * ***************************************************************************
 * Обработчик ввода в поле комментария.
 *
 * Enter (десктоп, без Shift) отправляет комментарий; на мобильных Enter
 * вставляет перенос строки — там отправка только кнопкой. На каждое изменение
 * пересчитываются кнопки футера (отправить/голос).
 * @param event - Событие ввода (keydown/input).
 * @param form - Экземпляр формы.
 * @returns void
 * ***************************************************************************
 */
export function onInputTextareaHandler(event: TextareaInputEvent, form: Comments): void {

    try {

        // Если формы нет
        if (!form) return;

        // ---------- ENTER = ОТПРАВКА (только десктоп) ----------
        if (isKeyboardEvent(event) && event.key === "Enter" && !event.shiftKey && !IsMobile.get()) {

            // Не даём браузеру вставить перенос строки
            event.preventDefault();

            // Режим редактирования — обновление вместо создания
            if (form.editedComment) { updateCommentHandler(form); return; }

            createCommentHandler(form);
            return;

        }

        // Пересчёт кнопок футера по факту контента (текст появился/пропал)
        updateStateButtons(form);

    } catch (error) {
        Logger.error("[app][comments][input-textarea]", error);
    }

}
