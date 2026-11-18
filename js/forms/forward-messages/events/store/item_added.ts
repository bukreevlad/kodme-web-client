// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { ForwardChannelItem } from "../../components/channel.js";

// Импортируем functions
import { updateFolderUnread } from "../../functions/update_folder_unread.js";

// Импортируем типы
import { isForwardChannel } from "../../types.js";
import type { ForwardMessages } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на добавление канала в стор: строка появляется в общей папке
 * «Все» и во всех папках пользователя, куда входит канал (зеркало
 * главной формы). Темы корнем не показываются — как на Main.
 * @param form - Экземпляр формы.
 * @returns void
 * ***************************************************************************
 */
export function subscribeItemAdded(form: ForwardMessages): void {

    try {

        // Подписываемся на событие добавления нового элемента.
        // Стор локальный (живёт вместе с формой), утечки подписки нет
        form.store.on("item::added", (data) => {

            // Эмитим всегда, но payload может быть не каналом
            if (!isForwardChannel(data)) return;

            // Если пользователь не участник
            if (data.is_member === false) return;

            // Темы — не корневые строки списка (как на главной форме)
            if (data.kind === "topic") return;

            // Строка в каждую целевую панель: «Все» + папки строки. На каждую
            // панель — своя копия элемента: каждая регистрирует DOM-копию в
            // сторе, и удаление записи снимет их все разом
            const targets = ["all", ...(data.main_folders_ids ?? [])];
            for (const targetId of targets) {

                const item = new ForwardChannelItem(form, data);
                const pane = form.foldersTabs?.getPane(targetId);
                const list = pane?.querySelector<HTMLElement>("[data-list]");
                if (list) list.appendChild(item.element);

            }

            // Бейджи непрочитанных на вкладках папок
            updateFolderUnread(form);

        });

    } catch (error) {
        Logger.error(error);
    }

}
