// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем dialogs
import { EditBotCommand } from "../../bot-command-edit/index.js";

// Импортируем functions
import { buildTreeArray } from "../functions/build_tree_array.js";
import { goToCategory } from "../functions/go_to_category.js";

// Импортируем типы
import type { BotMenuRecord } from "../types.js";
import type { BotSettings } from "../index.js";

/**
 * ***************************************************************************
 * Открытие диалога редактирования команды меню: правит запись в профиле
 * либо удаляет её и перерисовывает меню.
 *
 * @param form - Экземпляр формы.
 * @param command - Команда для редактирования.
 * ***************************************************************************
 */
export function editCommandHandler(form: BotSettings, command: BotMenuRecord): void {

    try {

        // Открываем диалог редактирования команды
        new EditBotCommand({
            botId: form.botId,
            command: command,
            callback: (data) => {

                // Если редактирование
                if (data.type === "edit") {

                    // Обновляем данные
                    form.profile?.bot_commands.forEach(c => {
                        if (c.id === command.id) {
                            c.command = data.command;
                            c.name = data.name;
                            c.about = data.about;
                        }
                    });

                }

                // Если удаление
                if (data.type === "remove") {
                    if (form.profile) form.profile.bot_commands = form.profile?.bot_commands.filter(c => c.id != command.id);
                }

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
