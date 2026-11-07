// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { SecretChatsManager } from "../../../../core/managers/secret_chats_manager.js";

// Импортируем functions
import { updateSecretChatRow } from "../../functions/get_secret_chats.js";
import { sortChatListVisually } from "../../functions/sort_chat_list.js";
import { updateFolderUnread } from "../../functions/update_folder_unread.js";

// Импортируем forms
import { Main } from "../../index.js";

/**
 * ***************************************************************************
 * SECRET_CHAT_EVENTS - подписки главной формы на события SecretChatsManager.
 *
 * Секретные чаты не проходят через сервер и сокет-события канала: их
 * обновления (сообщения, статусы, удаление) приходят от менеджера и здесь
 * переносятся в строку общего списка диалогов.
 * ***************************************************************************
 */
export class SecretChatEvents {

    /**
     * ***************************************************************************
     * Подписаться на события менеджера секретных чатов.
     * @param form - Экземпляр формы.
     * ***************************************************************************
     */
    static init(form: Main): void {

        // Менеджер секретных чатов создаётся вместе с home; без него
        // подписываться не на что (секретных чатов у сессии ещё нет)
        const manager = SecretChatsManager.instance;
        if (!manager) return;

        /** Обновить строку секретного чата и пересортировать список. */
        const refresh = (chatId: string) => {

            updateSecretChatRow(form, chatId).then(() => {

                // Main-инстанс мог закрыться, пока шло обновление строки
                const main = Main.instance;
                if (!main) return;

                // Обновляем бейджи непрочитанных на вкладках папок
                updateFolderUnread(main);

                // Визуальная сортировка списков, где лежит строка
                const foldersTabs = main.foldersTabs;
                const currentIdFolder = foldersTabs?.currentId;
                const currentPane = currentIdFolder != null ? foldersTabs?.getPane(currentIdFolder) : undefined;
                const currentList = currentPane?.querySelector<HTMLElement>("[data-list]") ?? null;
                sortChatListVisually(currentList, main.store);

                // Секретные строки всегда живут в общей папке «Все» —
                // сортируем и её (текущая вкладка может быть другой)
                const allList = foldersTabs?.getPane("all")?.querySelector<HTMLElement>("[data-list]") ?? null;
                if (allList !== currentList) sortChatListVisually(allList, main.store);

            }).catch((error) => {
                Logger.error("[app][main][secret-chat-events]: ошибка обновления строки:", error);
            });

        };

        // Новое/изменённое сообщение — обновляем превью и непрочитанные
        manager.on("message::added", ({ chatId }) => refresh(chatId));
        manager.on("message::updated", ({ chatId }) => refresh(chatId));
        manager.on("message::removed", ({ chatId }) => refresh(chatId));

        // Обновление чата (статус, таймер, удаление у обоих)
        manager.on("chat::updated", ({ chatId }) => refresh(chatId));

        // Смена состояния P2P-соединения — бейдж на аватарке строки
        manager.on("connection::state", ({ chatId }) => refresh(chatId));

    }

}
