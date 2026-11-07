// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем dialogs
import { AddBotCategory } from "../../bot-category-create/index.js";

// Импортируем functions
import { buildTreeArray } from "../functions/build_tree_array.js";
import { goToCategory } from "../functions/go_to_category.js";

// Импортируем типы
import type { BotSettings } from "../index.js";

/**
 * ***************************************************************************
 * Открытие диалога создания папки меню: по подтверждению добавляет папку
 * в текущую категорию и перерисовывает меню.
 *
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function addCategoryHandler(form: BotSettings): void {

    try {

        // Открываем диалог создания папки
        new AddBotCategory({
            botId: form.botId,
            callback: (draft) => {

                // Запись новой папки в профиль
                form.profile?.bot_commands.push({
                    id: crypto.randomUUID(),
                    categoryId: form.currentCategoryId,
                    name: draft.name,
                    about: draft.about
                });

                // Создаем дерево из комманд и категорий
                form.menuTree = buildTreeArray(form.profile?.bot_commands ?? []);

                // Отображаем текущую категорию
                goToCategory(form, form.currentCategoryId);

            }
        });

    } catch (error) {
        Logger.error(error);
    }

}
