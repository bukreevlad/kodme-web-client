// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { createCloudFolderItem } from "../../components/folder_item.js";
import { createCloudFileItem } from "../../components/file_item.js";
import { createCloudAvailableItem } from "../../components/available_item.js";

// Импортируем типы
import { isCloudItem, isCloudAvailableLink } from "../../types.js";
import type { Cloud } from "../../index.js";

/**
 * ***************************************************************************
 * Подписка на события добавления элементов в хранилища формы:
 * «Моё облако», «Доступное для меня» и «Общий доступ».
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function subscribeItemAdded(form: Cloud): void {

    try {

        // Подписываемся на событие добавления элемента в «Моё облако»
        form.store.on("item::added", (data) => {

            // Стор шлёт payload как unknown — сверяемся guard'ом
            if (!isCloudItem(data)) return;

            // Создаем DOM-элемент (папка или файл)
            let item = data.item_type === "folder"
                ? createCloudFolderItem(form, data)
                : createCloudFileItem(form, data);

            // Добавляем в список
            form.listMine?.appendChild(item);

            // Обновляем пустые состояния
            form._updateEmptyStates();

        });

        // Подписываемся на событие добавления доступной ссылки
        form.availableStore.on("item::added", (data) => {

            // Стор шлёт payload как unknown — сверяемся guard'ом
            if (!isCloudAvailableLink(data)) return;

            // Создаем DOM-элемент
            let item = createCloudAvailableItem(form, data);

            // Добавляем в список
            form.listAvailable?.appendChild(item);

            // Обновляем пустые состояния
            form._updateEmptyStates();

        });

        // Подписываемся на событие добавления элемента в «Общий доступ»
        form.sharedStore.on("item::added", (data) => {

            // Стор шлёт payload как unknown — сверяемся guard'ом
            if (!isCloudItem(data)) return;

            // Создаем DOM-элемент (папка или файл) в режиме общего доступа
            let item = data.item_type === "folder"
                ? createCloudFolderItem(form, data, form.sharedStore, "shared")
                : createCloudFileItem(form, data, form.sharedStore, "shared");

            // Добавляем в список
            form.listShared?.appendChild(item);

            // Обновляем пустые состояния
            form._updateEmptyStates();

        });

    } catch (error) {
        Logger.error(error);
    }

}
