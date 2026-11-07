// Импортируем сторонние пакеты
import Validator from "validator";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем типы
import type { EditBotCommand } from "../index.js";

/**
 * ***************************************************************************
 * Проверка полей формы команды и передача редактирования в колбэк формы.
 *
 * @param form - Экземпляр диалога.
 * ***************************************************************************
 */
export async function saveHandler(form: EditBotCommand): Promise<void> {

    // Без шаблона сохранять нечего
    const tpl = form.tpl;
    if (!tpl) return;

    // Устанавливаем элементы
    let command = tpl.querySelector<HTMLInputElement>(":scope >.content [name=command]");
    let name = tpl.querySelector<HTMLInputElement>(":scope >.content [name=name]");
    let about = tpl.querySelector<HTMLInputElement>(":scope >.content [name=about]");

    // Поля обязаны входить в шаблон — иначе сохранять нечего
    if (!command || !name || !about) return;

    try {

        // Проверка данных
        let pregCommand = /^[\p{sc=Cyrillic}\p{sc=Common}\p{sc=Latin}]{2,255}$/u;

        // Проверяем команду
        if (!Validator.matches(command.value, pregCommand)) {
            throw "Наберите команду";
        }

        // Отправляем ответ
        form.callback({
            type: "edit",
            command: command.value,
            name: name.value,
            about: about.value
        });
        form.modal?.close();

    } catch (error) {

        // Если неверная команда
        Toast.error(error instanceof Error ? error : String(error), { position: "bottom-center" });

    }

}
