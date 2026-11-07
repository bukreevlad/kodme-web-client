// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { showMenuBot } from "./show_menu_bot.js";
import { genPathToCurrentCategory } from "./gen_path_to_current_category.js";

// Импортируем components
import { createPathItem } from "../components/path.js";

// Импортируем типы
import type { BotMenuNode, BotPathCrumb } from "../types.js";
import type { BotSettings } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Отображение хлебной крошки пути до текущей категории.
 *
 * Легаси писал имя корня (`./Меню`) прямо в массив `form.menuTree` —
 * мусорное свойство массива не живёт в честных типах, поэтому корень
 * строится отдельным узлом-крошкой.
 *
 * @param form - Экземпляр формы.
 * @param path - Путь до текущей категории (null — корень, крошки скрыты).
 * ***************************************************************************
 */
export function updatePath(form: BotSettings, path: BotMenuNode[] | null = null): void {

    try {

        // Список категорий
        let list = form.tpl?.querySelector<HTMLElement>(":scope >.content [data-path]");
        if (list) list.innerHTML = "";

        // Если есть путь
        if (path && path.length > 0) {

            // Создаем корневой элемент и отображаем
            let root: BotPathCrumb = { name: `./${t("forms.bot_settings.menu")}` };
            let item = createPathItem(root);
            list?.append(item);

            // Клик: перейти в категорию
            item.addEventListener("click", () => {

                // Отображаем категорию
                showMenuBot(form, form.menuTree);
                form.currentCategoryId = null;

                // Генерируем путь до категории
                let nextPath = genPathToCurrentCategory(form.menuTree, "");
                updatePath(form, nextPath);

            });

        }

        // Перебираем элементы пути
        path && path.forEach(p => {

            // Создаем элемент и отображаем
            let item = createPathItem(p);
            list?.append(item);

            // Клик: перейти в категорию
            item.addEventListener("click", () => {

                // Отображаем категорию
                showMenuBot(form, p.children);
                form.currentCategoryId = p.id;

                // Генерируем путь до категории
                let nextPath = genPathToCurrentCategory(form.menuTree, p.id);
                updatePath(form, nextPath);

            });

        });

    } catch (error) {
        Logger.error(error);
    }

}
