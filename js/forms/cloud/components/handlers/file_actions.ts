// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../../../components/overlay/index.js";
import { createPopoverMenu } from "../../../../components/overlay/popover_menu.js";

// Импортируем handlers формы
import { downloadFileHandler } from "../../handlers/download_file.js";
import { removeFileHandler } from "../../handlers/remove_file.js";

// Импортируем dialogs
import { CreateShareLink } from "../../../cloud-share-link-create/index.js";
import { ShareLinks } from "../../dialogs/share_links/index.js";

// Импортируем типы
import type { PopoverMenuInput } from "../../../../components/overlay/popover_menu.js";
import type { CloudFileItemHandle } from "../file_item.js";
import { t } from "../../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Контекстное меню файла: скачать, поделиться, ссылки, удалить.
 * В общем доступе (по ссылке) — только скачать и удалить.
 * @param event - Событие клика по кнопке действий.
 * @param item - Компонент файла.
 * ***************************************************************************
 */
export async function openFileActions(event: MouseEvent, item: CloudFileItemHandle): Promise<void> {

    try {

        // Получение координат из события (меню открывается кликом мыши
        // или тачем — синтезированный click несёт clientX/clientY)
        let x = event.clientX || 0;
        let y = event.clientY || 0;

        // Определение списка элементов меню
        const menuItems: PopoverMenuInput[] = [];

        // Режим элемента: в общем доступе — только скачивание и удаление
        // (поделиться и ссылки доступны владельцу в своём облаке)
        let shared = item.mode === "shared";

        // ================================
        // Скачать файл
        menuItems.push({
            text: t("forms.cloud.actions.download"),
            iconName: "download",
            onClick: () => downloadFileHandler(item.data)
        });

        // ================================
        // Поделиться (создать ссылку)
        if (!shared) {
            menuItems.push({
                text: t("forms.cloud.actions.share"),
                iconName: "share",
                onClick: () => new CreateShareLink({ form: item.form, item: item.data })
            });

            // ================================
            // Ссылки (список ссылок элемента)
            menuItems.push({
                text: t("forms.cloud.actions.links"),
                iconName: "link",
                onClick: () => new ShareLinks({ form: item.form, item: item.data })
            });
        }

        // ================================
        // Удалить файл (по ссылке сервер проверит право записи)
        menuItems.push({ text: "", isSeparator: true }); // text обязателен типом пункта, при isSeparator не читается
        menuItems.push({
            text: t("forms.cloud.actions.remove"),
            iconName: "trash",
            cssClasses: ["text-[var(--color-red)]"],
            onClick: () => removeFileHandler(item.form, item.data)
        });

        // ================================

        // Открываем меню
        const contextMenu = new Overlay(createPopoverMenu(menuItems), {
            type: "popover",
            x: x,
            y: y
        });

        contextMenu.open();

    } catch (error) {
        Logger.error(error);
    }

}
