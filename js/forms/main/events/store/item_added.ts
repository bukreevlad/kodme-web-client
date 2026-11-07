// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { ChannelItem } from "../../components/channel.js";
import { SecretChatItem } from "../../components/secret_chat.js";

// Импортируем типы
import { isChannelRecord } from "../../types.js";
import type { Main } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на добавление канала в стор: строка появляется в общей папке
 * и во всех папках пользователя, куда входит канал.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeItemAdded(form: Main): void {

    try {

        // Подписываемся на событие добавления нового элемента
        form.store.on("item::added", (data) => {

            // Пейлоад стора типизирован как unknown: строку строим только для записи канала
            if (!isChannelRecord(data)) return;

            // Если пользователь не участник
            if (data.is_member === false) return;

            // Устанавливаем параметры: секретный чат получает свою строку
            // (своя логика превью, данные — расшифрованный payload)
            const item = data.is_secret_chat ? new SecretChatItem(form, data) : new ChannelItem(form, data);

            // Добавляем в список
            if (data.type !== 4) {
                const pane = form.foldersTabs?.getPane("all");
                const list = pane?.querySelector<HTMLElement>("[data-list]");
                list && list.appendChild(item.element);
            }

            // ==================================

            // Получаем папки канала
            const folders = data?.main_folders_ids;

            // Если папки есть
            if (folders && folders.length > 0) {

                // Проходим по папкам и добавляем канал туда
                folders.forEach(folderId => {

                    // Устанавливаем параметры (секретный чат — своей строкой)
                    const folderItem = data.is_secret_chat ? new SecretChatItem(form, data) : new ChannelItem(form, data);

                    // Добавляем в список
                    const pane = form.foldersTabs?.getPane(folderId);
                    const list = pane?.querySelector<HTMLElement>("[data-list]");
                    list && list.appendChild(folderItem.element);

                });

            }

        });

    } catch (error) {
        Logger.error(error);
    }

}
