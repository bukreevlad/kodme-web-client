// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { Comments } from "../index.js";

/**
 * ***************************************************************************
 * resetTextarea - сброс поля ввода: текст, состояние валидации и высота.
 * @param form - Экземпляр формы.
 * @returns void
 * ***************************************************************************
 */
export function resetTextarea(form: Comments): void {

    try {

        // Устанавливаем объекты (кэшированный form.textarea — без повторного
        // querySelector по :scope)
        let textarea = form.textarea || form.tpl?.querySelector(`:scope >.footer [name="comment"]`);
        if (!textarea) return;

        // Сбрасываем текст
        textarea.value = "";

        // Снимаем состояние ошибки валидации (класс .invalid ставится при пустой отправке)
        textarea.classList.remove("invalid");

        // Обновляем высоту (autosize пересчитывается по пустому value)
        textarea.dispatchEvent(new Event("input"));

    } catch (error) {
        Logger.error("[app][comments][reset-textarea]", error);
    }

}
