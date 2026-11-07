// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { sortChannels } from "./sort_channels.js";
import { loadSecretChatRows } from "./get_secret_chats.js";

// Импортируем db
import { channelsTable } from "../db.js";

// Импортируем типы
import type { Main } from "../index.js";
import type { AddPageOptions } from "../types.js";

/**
 * ***************************************************************************
 * Загрузить каналы из IndexedDB в список главной формы.
 *
 * Порядок вставки берётся из sortChannels (свежие сверху); направление
 * `next` прокидывается в стор, чтобы подписчики страницы знали край.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export async function getChannels(form: Main): Promise<void> {

    try {

        // Очищаем store (предыдущая папка/экземпляр больше не актуальны)
        form.store.removeAll();

        // Получаем каналы из IndexedDb
        const channels = await channelsTable().toArray();

        // Подмешиваем секретные чаты: они живут только локально и мерджатся
        // в общий список диалогов наравне с серверными каналами
        const secretRows = await loadSecretChatRows();

        // Сортируем каналы по времени последнего сообщения
        const sortedChannels = sortChannels([...channels, ...secretRows]);

        // Проходим по каналам
        for (const channel of sortedChannels) {

            // Добавляем строку в Store (UI), либо обновляем уже лежащую
            const isStore = form.store.get(channel.id);
            if (isStore) {
                form.store.update(channel.id, channel);
            } else {

                // Направление вставки передаём переменной: стор принимает
                // StoreAddOptions, а direction он просто пробрасывает подписчикам
                const options: AddPageOptions = { direction: "next" };
                form.store.add(channel, options);

            }

        }

    } catch (error) {
        Logger.error(error);
    }

}
