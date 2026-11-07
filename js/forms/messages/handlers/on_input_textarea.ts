// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { IsMobile } from "../../../utils/helpers/is_mobile.js";
import { LocalStorage } from "../../../utils/local_storage.js";

// Импортируем handlers
import { createMessageHandler } from "./create_message.js";
import { updateMessageHandler } from "./update_message.js";

// Импортируем functions
import { updateStateButtons } from "../functions/update_state_buttons.js";

// Импортируем типы
import type { MessageRecord } from "../types.js";
import type { Messages } from "../index.js";
import type { SessionProfile } from "../../menu/types.js";

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
export async function onInputTextareaHandler(event: TextareaInputEvent, form: Messages): Promise<void> {

    try {

        // Если нет формы
        if (!form) return;

        // Снимаем подсветку ошибки валидации: пользователь начал исправлять
        form.textarea?.classList?.remove("invalid");

        // Отправляем статус активности
        if ([1, 2, 4, 6, 7].includes(form.channel?.type ?? -1)) {
            // textarea может отсутствовать (нет поля ввода) — тогда статус не шлём
            const inputLength = form.textarea?.value.trim().length ?? 0;
            if (event.type === "input" && inputLength > 0) {
                form.typingStatus.send({ action: "typing" });
            }
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

                // Если есть временное сообщение
                if (form.tempMessage) return;

                // Получаем все элементы
                let items = form.store.getAll();

                // invariant: user хранится как unknown на границе localStorage; читаем id
                const sessionUserId = (LocalStorage.session?.user as SessionProfile).id;

                // Ищем своё последнее сообщение (обход с конца: findLast нет в целевой версии lib)
                let item: MessageRecord | undefined;
                for (let i = items.length - 1; i >= 0; i--) {
                    const candidate = items[i];
                    if (candidate && candidate.created_user_id === sessionUserId) {
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
