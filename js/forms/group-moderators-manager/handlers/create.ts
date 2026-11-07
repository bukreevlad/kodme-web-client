// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем forms
import { Search } from "../../search/index.js";
import { GroupAddModerator } from "../../group-moderator-create/index.js";

// Импортируем типы
import type { GroupModeratorsManager } from "../index.js";

/**
 * ***************************************************************************
 * Открытие поиска пользователей для назначения модератора: из выбранной
 * записи открывается диалог добавления модератора группы.
 * @param form - Форма.
 * ***************************************************************************
 */
export async function createHandler(form: GroupModeratorsManager): Promise<void> {

    try {

        // Открываем форму поиска
        new Search({
            allowSearchType: ["users", "bots"],
            searchType: "users",
            callback: (record) => {

                // Открываем форму добавления модератора
                new GroupAddModerator({ user: record, channelId: form.channelId });

            },
            options: {
                insertInto: form.modal?.content,
            }
        });

    } catch (error) {
        Logger.error(error);
    }

}
