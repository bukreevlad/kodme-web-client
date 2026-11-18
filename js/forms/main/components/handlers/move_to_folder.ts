// Импортируем utils
import { FormsRegistry } from "../../../../core/managers/forms_registry.js";
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../../components/toast.js";
import type { ChannelItem } from "../channel.js";

// Импортируем forms
import { Main } from "../../../main/index.js";
import { MainFoldersManager } from "../../../main-folders-manager/index.js";

// Импортируем requests
import { moveToFolderRequest } from "../../../messages/requests/move_to_folder.js";
import { unmoveFromFolderRequest } from "../../../messages/requests/unmove_from_folder.js";

// Импортируем functions
import { addChannelToFolderPane, removeChannelFromFolderPane } from "../../functions/folder_pane.js";
import { updateFolderUnread } from "../../functions/update_folder_unread.js";

// Импортируем db
import { channelsTable } from "../../db.js";

// Импортируем типы
import { t } from "../../../../utils/i18n/index.js";

/**
 * Выбор папки в диалоге менеджера папок: канал добавляется в папку
 * (is_selected) либо убирается из неё.
 */
interface FolderSelection {

    /** Id папки. */
    id: string;

    /** Папка выбрана каналом (true) либо снимается с него (false). */
    is_selected?: boolean;

}

/**
 * ***************************************************************************
 * Добавление/удаление канала в папке.
 * @param channel - Строка канала.
 * ***************************************************************************
 */
export async function moveToFolderHandler(channel: ChannelItem): Promise<void> {

    try {

        // Отображаем форму выбора папки
        new MainFoldersManager({
            selectedFolders: channel?.data?.main_folders_ids || [],
            callback: async (folder: FolderSelection) => {
                if (folder && folder.id) {

                    try {

                        // Если папка выбрана
                        if (folder.is_selected) {

                            // Запрос
                            const response = await moveToFolderRequest({
                                channel_id: channel.data.id,
                                main_folder_id: folder.id
                            });

                            // Если запрос выполнен
                            if (response) {

                                // Обновляем данные канала (добавляем папку)
                                channel.data.main_folders_ids?.push(folder.id);
                                FormsRegistry.getOwner<Main>("main")?.store.update(channel.data.id, channel.data);

                                // Обновляем IndexedDB
                                await channelsTable().update(channel.data.id, {
                                    main_folders_ids: channel.data.main_folders_ids
                                });

                                // Добавляем канал в панель папки, чтобы он сразу появился
                                addChannelToFolderPane(folder.id, channel.data);

                                // Обновляем бейджи непрочитанных на вкладках папок
                                const main = FormsRegistry.getOwner<Main>("main");

                                if (main) updateFolderUnread(main);

                                // Toast
                                Toast.success(t("forms.main.components.channels.context_menu.toasts.success_move_to_folder"), {
                                    position: "bottom-center"
                                });

                            }

                            // Если папка не выбрана
                        } else {

                            // Запрос
                            const response = await unmoveFromFolderRequest({
                                channel_id: channel.data.id,
                                main_folder_id: folder.id
                            });

                            // Если запрос выполнен
                            if (response) {

                                // Обновляем данные канала (убираем папку)
                                const filteredFolders = (channel.data.main_folders_ids || []).filter(f => f !== folder.id);
                                channel.data.main_folders_ids = filteredFolders || [];
                                FormsRegistry.getOwner<Main>("main")?.store.update(channel.data.id, channel.data);

                                // Обновляем IndexedDB
                                await channelsTable().update(channel.data.id, {
                                    main_folders_ids: filteredFolders
                                });

                                // Убираем канал из панели папки
                                removeChannelFromFolderPane(folder.id, channel.data);

                                // Обновляем бейджи непрочитанных на вкладках папок
                                const main = FormsRegistry.getOwner<Main>("main");

                                if (main) updateFolderUnread(main);

                                // Toast
                                Toast.success(t("forms.main.components.channels.context_menu.toasts.success_unmove_from_folder"), {
                                    position: "bottom-center"
                                });

                            }

                        }

                    } catch (error) {
                        Logger.error(error);

                        // Прочая ошибка сервера
                        Toast.error(t("api.errors.server_error"));

                    }

                }
            }
        });

    } catch (error) {
        Logger.error(error);
    }

}
