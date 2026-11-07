// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем dialogs
import { ImportBotCommands } from "../dialogs/import_json/index.js";

// Импортируем functions
import { buildTreeArray } from "../functions/build_tree_array.js";
import { updatePath } from "../functions/update_path.js";
import { showMenuBot } from "../functions/show_menu_bot.js";

// Импортируем типы
import type { BotMenuRecord } from "../types.js";
import type { BotSettings } from "../index.js";

/**
 * ***************************************************************************
 * Открытие диалога импорта меню из JSON: заменяет `bot_commands`
 * профиля, сбрасывает категорию в корень и перерисовывает меню с путём.
 *
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function importJsonHandler(form: BotSettings): void {

    try {

        // Открываем диалог импорта меню
        new ImportBotCommands({
            botId: form.botId,
            callback: (json) => {

                // Разбор JSON уже проверен диалогом (Validator.isJSON)
                let parsed: BotMenuRecord[] = JSON.parse(json);

                // Устанавливаем новое меню боту
                if (form.profile) form.profile.bot_commands = parsed;

                // Создаем дерево из комманд и категорий
                form.menuTree = buildTreeArray(form.profile?.bot_commands ?? []);

                // Сбрасываем категорию
                form.currentCategoryId = null;

                // Сбрасываем путь
                updatePath(form);

                // Отображаем меню бота
                showMenuBot(form, form.menuTree);

            }
        });

    } catch (error) {
        Logger.error(error);
    }

}
