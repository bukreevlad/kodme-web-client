// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { SecretChat } from "../index.js";

/**
 * ***************************************************************************
 * resetTextarea - сброс поля ввода: текст, состояние валидации и высота.
 * @param form - Экземпляр формы.
 * @returns void
 * ***************************************************************************
 */
export function resetTextarea(form: SecretChat): void {

    try {

        // Устанавливаем объекты.
        // Используем кэшированный form.textarea: повторный querySelector по
        // :scope каждый раз заново обходил DOM футера без нужды.
        let textarea = form.textarea || form.tpl?.querySelector(`:scope >.footer [name="message"]`);
        if (!textarea) return;

        // Сбрасываем текст
        textarea.value = "";

        // Снимаем состояние ошибки валидации (класс .invalid ставится при пустой отправке)
        textarea.classList.remove("invalid");

        // Обновляем высоту текстового поля
        if (form.textareaAutosize) {

            // Ожидаем отрисовку 1 кадра
            requestAnimationFrame(() => {
                form.textareaAutosize?.update();
            });

        }

    } catch (error) {
        Logger.error("[app][secret-chat][reset-textarea]:", error);
    }

}
