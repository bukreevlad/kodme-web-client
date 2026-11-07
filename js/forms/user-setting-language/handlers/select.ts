// Импортируем utils
import { I18n } from "../../../utils/i18n/index.js";

// Импортируем dialogs
import { ConfirmLanguageChange } from "../dialogs/confirm/index.js";

// Импортируем типы
import type { UserSettingLanguage } from "../index.js";

/**
 * ***************************************************************************
 * selectLanguageHandler - выбор языка в списке: открывает диалог
 * подтверждения, после подтверждения закрывает форму и сменяет язык —
 * открытые экраны обновляются на месте через I18n.refresh.
 * @param form - Экземпляр формы.
 * @param code - Код языка из атрибута radio (без него выбора нет).
 * @param name - Отображаемое имя языка для текста подтверждения.
 * @returns void
 * ***************************************************************************
 */
export function selectLanguageHandler(form: UserSettingLanguage, code?: string, name?: string): void {

    // Значения приходят из атрибутов radio — без них смысла в выборе нет
    if (!code || !name) return;

    const dialog = new ConfirmLanguageChange({
        name,
        options: { insertInto: form.modal?.content },
        callback: async (confirmed) => {

            // Закрываем диалог в любом случае
            dialog.modal?.close();

            if (!confirmed) return;

            // Сначала возврат к настройкам: смена языка обновит их тексты
            // на месте через I18n.refresh — пересборка форм не нужна
            await form.modal?.close();
            await I18n.changeLanguage(code);

        }
    });

}
