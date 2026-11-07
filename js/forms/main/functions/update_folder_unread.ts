// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import { parseUnread } from "../types.js";
import type { Main } from "../index.js";
import type { ChannelRecord } from "../types.js";

/**
 * ***************************************************************************
 * Обновить бейджи непрочитанных сообщений на вкладках папок.
 *
 * Непрочитанные берём из стора главной формы (total_unread_messages),
 * как в списке каналов: у групп суммируются непрочитанные их тем.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function updateFolderUnread(form: Main): void {

    try {

        // Получаем все каналы из хранилища
        const channels = form.store.getAll();

        // Темы групп (учитываются через свою группу, а не отдельно)
        const topics = channels.filter(channel => channel.topic_for_group_id);

        /**
         * Считаем непрочитанные сообщения канала, как в списке:
         * у групп суммируются непрочитанные её тем.
         * @param channel - Данные канала.
         * @returns Количество непрочитанных сообщений.
         */
        const unreadOf = (channel: ChannelRecord): number => {
            let total = parseUnread(channel.total_unread_messages) || 0;

            // Если это группа — прибавляем непрочитанные её тем
            if (channel.type === 2) {
                topics.forEach(topic => {
                    if (topic.topic_for_group_id === channel.id) {
                        total += parseUnread(topic.total_unread_messages) || 0;
                    }
                });
            }

            return total;
        };

        // Проходим по вкладкам папок
        form.foldersTabs?.tabLinksElements.forEach(link => {

            // Id папки вкладки
            const folderId = link.getAttribute("data-target") ?? "";

            // Сумма непрочитанных в папке
            let unread = 0;

            // Проходим по каналам
            channels.forEach(channel => {

                // Темы не считаем отдельно — они входят в свою группу
                if (channel.topic_for_group_id) return;

                // Для папки «Все» учитываем все каналы
                if (folderId !== "all") {

                    // Пропускаем каналы, которых нет в этой папке
                    if (!Array.isArray(channel.main_folders_ids) || !channel.main_folders_ids.includes(folderId)) return;

                }

                // Прибавляем непрочитанные канала
                unread += unreadOf(channel);

            });

            // Обновляем бейдж
            const badge = link.querySelector<HTMLElement>("[data-unread]");
            if (badge) {
                const value = unread > 99 ? "99+" : (unread > 0 ? String(unread) : "");
                badge.textContent = value;

                // Видимость переключаем парой hidden/flex: display-утилиты
                // в Tailwind v4 идут по алфавиту и .hidden идёт после .flex
                badge.classList.toggle("hidden", unread <= 0);
                badge.classList.toggle("flex", unread > 0);
            }

        });

    } catch (error) {
        Logger.error("Ошибка при обновлении непрочитанных папок", error);
    }

}
