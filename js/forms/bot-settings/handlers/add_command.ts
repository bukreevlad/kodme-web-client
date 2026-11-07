// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем dialogs
import { AddBotCommand } from "../../bot-command-create/index.js";

// Импортируем functions
import { buildTreeArray } from "../functions/build_tree_array.js";
import { goToCategory } from "../functions/go_to_category.js";

// Импортируем типы
import type { BotSettings } from "../index.js";

/**
 * ***************************************************************************
 * Открытие диалога создания команды меню: по подтверждению добавляет
 * команду в текущую категорию и перерисовывает меню.
 *
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function addCommandHandler(form: BotSettings): void {

    try {

        // Открываем диалог создания команды
        new AddBotCommand({
            botId: form.botId,
            callback: (draft) => {

                // Запись новой команды в профиль
                form.profile?.bot_commands.push({
                    id: crypto.randomUUID(),
                    categoryId: form.currentCategoryId,
                    command: draft.command,
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
