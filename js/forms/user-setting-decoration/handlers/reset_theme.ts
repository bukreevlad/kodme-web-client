// Импортируем utils
import { Themes } from "../../../utils/themes.js";
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { UserSettingDecorations } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Сброс текущей сторонней темы на тему по умолчанию.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function resetThemeHandler(form: UserSettingDecorations): Promise<void> {

    // Название текущей темы
    const currentThemeName = form.tpl?.querySelector<HTMLElement>(`:scope >.content [data-current-theme]`);

    try {

        // Сбрасываем тему приложения
        Themes.resetCurrentTheme();

        // Устанавливаем текст
        if (currentThemeName) currentThemeName.textContent = t("forms.user_setting_decoration.not_selected");

    } catch (error) {
        Logger.error(error);
    }

}
