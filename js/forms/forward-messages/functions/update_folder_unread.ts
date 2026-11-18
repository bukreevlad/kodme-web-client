// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import { parseUnread } from "../../main/types.js";
import type { ForwardMessages } from "../index.js";

/**
 * ***************************************************************************
 * Обновить бейджи непрочитанных на вкладках папок (зеркало одноимённой
 * функции главной формы): суммы берутся из стора формы пересылки.
 *
 * Темы в список не входят (getChannels их отфильтровывает) — специфики
 * «группа суммирует свои темы» здесь нет.
 * @param form - Экземпляр формы.
 * @returns void
 * ***************************************************************************
 */
export function updateFolderUnread(form: ForwardMessages): void {

    try {

        // Получаем все каналы из хранилища
        const channels = form.store.getAll();

        // Проходим по вкладкам папок
        form.foldersTabs?.tabLinksElements.forEach(link => {

            // Id папки вкладки
            const folderId = link.getAttribute("data-target") ?? "";

            // Сумма непрочитанных в папке
            let unread = 0;

            // Проходим по каналам
            channels.forEach(channel => {

                // Для папки «Все» учитываем все каналы
                if (folderId !== "all") {

                    // Пропускаем каналы, которых нет в этой папке
                    if (!Array.isArray(channel.main_folders_ids) || !channel.main_folders_ids.includes(folderId)) return;

                }

                // Прибавляем непрочитанные канала
                unread += parseUnread(channel.total_unread_messages) || 0;

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
        Logger.error("[app][forward][update-folder-unread]:", error);
    }

}
