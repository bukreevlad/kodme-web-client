// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { createCommandItem } from "../components/command.js";
import { createCategoryItem } from "../components/category.js";

// Импортируем functions
import { genPathToCurrentCategory } from "./gen_path_to_current_category.js";
import { updatePath } from "./update_path.js";

// Импортируем handlers
import { editCommandHandler } from "../handlers/edit_command.js";
import { editCategoryHandler } from "../handlers/edit_category.js";

// Импортируем типы
import type { BotMenuNode } from "../types.js";
import type { BotSettings } from "../index.js";

/**
 * ***************************************************************************
 * Отображение содержимого категории меню бота: команды и вложенные папки.
 *
 * @param form - Экземпляр формы.
 * @param array - Узлы текущей категории (дерево либо дети категории).
 * ***************************************************************************
 */
export function showMenuBot(form: BotSettings, array: BotMenuNode[]): void {

    try {

        // Список
        let list = form.tpl?.querySelector<HTMLElement>(":scope >.content [data-menu]");
        if (list) list.innerHTML = "";

        // Проходим по списку
        array.forEach(item => {

            // Если это команда
            if (item.command) {

                // создаем элемент
                let command = createCommandItem(item);
                list?.append(command);

                // Кнопка редактировать
                command.querySelector("[action-edit]")
                    ?.addEventListener("click", (event) => {
                        event.stopPropagation();
                        editCommandHandler(form, item);
                    });

            }

            // Если это категория
            if (!item.command) {

                // создаем элемент
                let category = createCategoryItem(item);
                list?.append(category);

                // Клик: открытие категории
                category.addEventListener("click", () => {

                    // Отображаем категорию
                    showMenuBot(form, item.children);
                    form.currentCategoryId = item.id;

                    // Генерируем путь до категории
                    let path = genPathToCurrentCategory(form.menuTree, item.id);
                    updatePath(form, path);

                });

                // Кнопка редактировать
                category.querySelector("[action-edit]")
                    ?.addEventListener("click", (event) => {
                        event.stopPropagation();
                        editCategoryHandler(form, item);
                    });

            }

        });

    } catch (error) {
        Logger.error(error);
    }

}
