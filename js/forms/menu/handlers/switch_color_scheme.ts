// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { Icons } from "../../../utils/icons.js";
import { Themes } from "../../../utils/themes.js";

// Импортируем типы
import type { Menu } from "../index.js";

/**
 * ***************************************************************************
 * Переключение цветовой схемы приложения (светлая ↔ тёмная).
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function switchColorSchemeHandler(form: Menu): Promise<void> {

    try {

        // Кнопка переключения
        const button = form.tpl?.querySelector(":scope >.header [action-swith-color-scheme]");

        // Проверяем выбранный режим; `?? ""` не даёт записать в кнопку
        // строку "undefined" при отсутствии иконки
        if (document.documentElement.hasAttribute("data-theme")) {

            // Устанавливаем светлую
            Themes.setAppTheme({ color_scheme: "light" });
            if (button) button.innerHTML = Icons.icon("Moon")?.outerHTML ?? "";

        } else {

            // Устанавливаем темную
            Themes.setAppTheme({ color_scheme: "dark" });
            if (button) button.innerHTML = Icons.icon("Sun")?.outerHTML ?? "";

        }

    } catch (error) {
        Logger.error(error);
    }

}
