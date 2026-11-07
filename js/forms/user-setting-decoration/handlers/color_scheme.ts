// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { Themes } from "../../../utils/themes.js";

// Импортируем типы
import type { UserSettingDecorations } from "../index.js";

/**
 * ***************************************************************************
 * Сохранение цветовой схемы приложения (system | light | dark).
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function colorSchemeHandler(form: UserSettingDecorations): Promise<void> {

    // Выбранная цветовая схема
    const colorScheme = form.tpl?.querySelector<HTMLInputElement>(`:scope >.content [name="color-scheme"]:checked`);

    try {

        // invariant: схема приходит из радиокнопок только с этими значениями
        const color = (colorScheme?.value as "system" | "dark" | "light") || "system";

        // Меняем цветовое решение
        Themes.setAppTheme({ color_scheme: color, update_session: true });

    } catch (error) {
        Logger.error(error);
    }

}
