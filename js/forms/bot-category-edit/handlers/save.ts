// Импортируем сторонние пакеты
import Validator from "validator";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем типы
import type { EditBotCategory } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Проверка полей формы папки и передача редактирования в колбэк формы.
 *
 * @param form - Экземпляр диалога.
 * ***************************************************************************
 */
export async function saveHandler(form: EditBotCategory): Promise<void> {

    // Устанавливаем элементы
    let name = form.tpl?.querySelector<HTMLInputElement>(":scope >.content [name=name]");
    let about = form.tpl?.querySelector<HTMLInputElement>(":scope >.content [name=about]");

    try {

        // Проверка данных
        let pregName = /^[\p{sc=Cyrillic}\p{sc=Common}\p{sc=Latin}]{1,255}$/u;

        // Проверяем название (нет поля ввода — то же, что пустое значение)
        const nameValue = name?.value;
        if (!nameValue || !Validator.matches(nameValue, pregName)) {
            throw t("forms.bot_editor.name_short");
        }

        // Отправляем ответ
        form.callback({
            type: "edit",
            name: nameValue,
            about: about?.value ?? ""
        });
        form.modal?.close();

    } catch (error) {

        // Если неверное название
        Toast.error(error instanceof Error ? error : String(error), { position: "bottom-center" });

    }

}
