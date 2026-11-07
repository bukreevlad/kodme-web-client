// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { IndexedDB } from "../../../utils/indexed_db.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем forms
import { Main } from "../../main/index.js";
import { MainFoldersManager } from "../../main-folders-manager/index.js";

// Импортируем requests
import { moveToFolderRequest } from "../requests/move_to_folder.js";
import { unmoveFromFolderRequest } from "../requests/unmove_from_folder.js";

// Импортируем типы
import type { ChannelRecord } from "../types.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * Элемент выбора папки, который возвращает MainFoldersManager
 * (только поля, используемые в этом обработчике).
 */
interface FolderChoice {

    /** Id папки. */
    id: string;

    /** Выбрана ли папка для канала (поле приходит из менеджера папок). */
    is_selected?: boolean;

}

/**
 * ***************************************************************************
 * Открыть форму выбора папки и переместить канал в папку либо из неё.
 * @param channel - Канал (запись form.channel).
 * @returns Promise, завершающийся после обновления.
 * ***************************************************************************
 */
export async function moveToFolderHandler(channel: ChannelRecord): Promise<void> {

    try {

        // Отображаем форму выбора папки
        new MainFoldersManager({
            selectedFolders: channel?.main_folders_ids || [],
            callback: async (folder: FolderChoice) => {
                if (folder && folder.id) {

                    // Если папка выбрана
                    if (folder.is_selected) {

                        // Запрос
                        let response = await moveToFolderRequest({
                            channel_id: channel.id,
                            main_folder_id: folder.id
                        });

                        // Если запрос выполнен
                        if (response) {

                            // Обновляем данные
                            channel.main_folders_ids?.push(folder.id);
                            Main.instance?.store.update(channel.id, channel);

                            // Обновляем IndexedDB
                            await IndexedDB.db?.table("channels").update(channel.id, {
                                main_folders_ids: channel.main_folders_ids
                            });

                            // Toast
                            Toast.success(t("forms.main.components.channels.context_menu.toasts.success_move_to_folder"), {
                                position: "bottom-center"
                            });

                        }

                        // Если папка не выбрана
                    } else {

                        // Запрос
                        let response = await unmoveFromFolderRequest({
                            channel_id: channel.id,
                            main_folder_id: folder.id
                        });

                        // Если запрос выполнен
                        if (response) {

                            // Обновляем данные
                            let filteredFolders = channel.main_folders_ids?.filter(f => f !== folder.id);
                            channel.main_folders_ids = filteredFolders || [];
                            Main.instance?.store.update(channel.id, channel);

                            // Обновляем IndexedDB
                            await IndexedDB.db?.table("channels").update(channel.id, {
                                main_folders_ids: filteredFolders
                            });

                            // Toast
                            Toast.success(t("forms.main.components.channels.context_menu.toasts.success_unmove_from_folder"), {
                                position: "bottom-center"
                            });

                        }

                    }

                }
            }
        });

    } catch (error) {
        Logger.error(error);
    }

}
