// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { IsMobile } from "../../../utils/helpers/is_mobile.js";

// Импортируем handlers
import { createMessageHandler } from "./create_message.js";
import { updateMessageHandler } from "./update_message.js";

// Импортируем functions
import { updateStateButtons } from "../functions/update_state_buttons.js";

// Импортируем типы
import type { SecretChatMessageRecord } from "../types.js";
import type { SecretChat } from "../index.js";

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
 * Обработать ввод в поле ввода: статус набора, отправка по Enter,
 * редактирование по стрелке вверх, обновление кнопок.
 * @param event - Событие ввода.
 * @param form - Экземпляр формы.
 * @returns Promise, завершающийся после обработки.
 * ***************************************************************************
 */
export async function onInputTextareaHandler(event: TextareaInputEvent, form: SecretChat): Promise<void> {

    try {

        // Если нет формы
        if (!form) return;

        // Снимаем подсветку ошибки валидации: пользователь начал исправлять
        form.textarea?.classList?.remove("invalid");

        // Отправляем статус активности (textarea может отсутствовать — тогда не шлём)
        const inputLength = form.textarea?.value.trim().length ?? 0;
        if (event.type === "input" && inputLength > 0) {
            form.typingStatus.send({ action: "typing" });
        }

        // Отправка или редактирование записи
        if (isKeyboardEvent(event) && event.key === "Enter" && !event.shiftKey && !IsMobile.get()) {

            // Если не редактируем сообщение
            if (!form.editedMessage) {
                event.preventDefault();
                createMessageHandler(form);
                return;
            }

            // Если редактируем сообщение
            if (form.editedMessage?.id) {
                event.preventDefault();
                updateMessageHandler(form);
                return;
            }

        } else {

            // Клавиша вверх для редактирования записи
            if (event.which == 38 && !form.editedMessage) {

                // Если какой то текст уже есть в поле ввода
                if (form.textarea?.value) return;

                // Если есть черновик ответа
                if (form.replyMessage) return;

                // Получаем все элементы
                let items = form.store.getAll();

                // Ищем своё последнее сообщение (обход с конца: findLast нет в целевой версии lib)
                let item: SecretChatMessageRecord | undefined;
                for (let i = items.length - 1; i >= 0; i--) {
                    const candidate = items[i];
                    if (candidate && candidate.sender === "me") {
                        item = candidate;
                        break;
                    }
                }

                if (item) item.__editMessage__?.();
                return;

            }

            // Обновляем состояние кнопок
            updateStateButtons(form);

        }

    } catch (error) {
        Logger.error(error);
    }

}
