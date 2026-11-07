// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем forms
import { GroupTopicCreate } from "../../group-topic-create/index.js";

// Импортируем типы
import type { GroupTopicsManager } from "../index.js";

/**
 * ************************************************************************
 * Открытие формы создания новой темы группы.
 * @param form - Форма.
 * ************************************************************************
 */
export async function createHandler(form: GroupTopicsManager): Promise<void> {

    try {

        // Открываем форму
        new GroupTopicCreate({ channelId: form.channelId });

    } catch (error) {
        Logger.error(error);
    }

}
