// Импортируем сторонние пакеты
import Validator from "validator";

// Импортируем components
import { Toast } from "../../../../../components/toast.js";

// Импортируем типы
import type { ImportBotCommands } from "../index.js";

/**
 * ***************************************************************************
 * Проверка JSON-строки меню и передача её в колбэк формы.
 *
 * @param form - Экземпляр диалога.
 * ***************************************************************************
 */
export async function importHandler(form: ImportBotCommands): Promise<void> {

    try {

        // Устанавливаем параметры
        let code = form.tpl?.querySelector<HTMLInputElement>(":scope >.content [name=code]");

        // Проверяем JSON (нет поля ввода — то же, что пустая строка)
        const codeValue = code?.value;
        if (!codeValue || !Validator.isJSON(codeValue)) {
            throw "Некорректный JSON";
        }

        // Отправляем ответ
        form.callback(codeValue);
        form.modal?.close();

    } catch (error) {

        // Если неверный json
        Toast.error(error instanceof Error ? error : String(error), { position: "bottom-center" });

    }

}
