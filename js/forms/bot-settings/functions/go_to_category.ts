// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { genPathToCurrentCategory } from "./gen_path_to_current_category.js";
import { showMenuBot } from "./show_menu_bot.js";
import { updatePath } from "./update_path.js";

// Импортируем типы
import type { BotSettings } from "../index.js";

/**
 * ***************************************************************************
 * Переход к категории меню: отображает её содержимое и путь до неё
 * (для корня — всё меню без крошек).
 *
 * @param form - Экземпляр формы.
 * @param id - Id категории (null — корень меню).
 * ***************************************************************************
 */
export function goToCategory(form: BotSettings, id: string | null): void {

    try {

        // Получаем текущую категорию
        let path = genPathToCurrentCategory(form.menuTree, id);

        // Переходим к нужной дирректории
        if (path && path.length > 0) {
            const target = path[path.length - 1];
            if (target) showMenuBot(form, target.children);
        } else {
            showMenuBot(form, form.menuTree);
        }

        // Обновляем путь
        updatePath(form, path);

    } catch (error) {
        Logger.error(error);
    }

}
