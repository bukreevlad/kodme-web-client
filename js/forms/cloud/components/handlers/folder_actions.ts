// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { readEventPoint } from "../../../../utils/dom/read_event_point.js";

// Импортируем components
import { Overlay } from "../../../../components/overlay/index.js";
import { createPopoverMenu } from "../../../../components/overlay/popover_menu.js";

// Импортируем handlers формы
import { openFolderHandler } from "../../handlers/open_folder.js";
import { openSharedFolderHandler } from "../../handlers/open_shared_folder.js";
import { removeFolderHandler } from "../../handlers/remove_folder.js";

// Импортируем dialogs
import { CreateShareLink } from "../../../cloud-share-link-create/index.js";
import { ShareLinks } from "../../dialogs/share_links/index.js";

// Импортируем типы
import type { PopoverMenuInput } from "../../../../components/overlay/popover_menu.js";
import type { CloudFolderItemHandle } from "../folder_item.js";
import { t } from "../../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Контекстное меню папки: открыть, поделиться, ссылки, удалить.
 * В общем доступе (по ссылке) — только открыть и удалить.
 * @param event - Событие (мышь или долгий тап: координаты читаем по типу).
 * @param item - Компонент папки.
 * ***************************************************************************
 */
export async function openFolderActions(event: Event, item: CloudFolderItemHandle): Promise<void> {

    try {

        // Получение координат из события: в MouseEvent они в clientX/clientY,
        // а в touch-событиях — в changedTouches
        const point = readEventPoint(event);
        const x = point?.x ?? 0;
        const y = point?.y ?? 0;

        // Определение списка элементов меню
        const menuItems: PopoverMenuInput[] = [];

        // Режим элемента: в общем доступе — только открытие и удаление
        // (поделиться и ссылки доступны владельцу в своём облаке)
        let shared = item.mode === "shared";

        // ================================
        // Открыть папку
        menuItems.push({
            text: t("forms.cloud.actions.open"),
            iconName: "folder-open",
            onClick: () => shared
                ? openSharedFolderHandler(item.form, item.data)
                : openFolderHandler(item.form, item.data)
        });

        // ================================
        // Поделиться (создать ссылку)
        if (!shared) {
            menuItems.push({
                text: t("forms.cloud.actions.share"),
                iconName: "share",
                onClick: () => new CreateShareLink({ item: item.data })
            });

            // ================================
            // Ссылки (список ссылок элемента)
            menuItems.push({
                text: t("forms.cloud.actions.links"),
                iconName: "link",
                onClick: () => new ShareLinks({ item: item.data })
            });
        }

        // ================================
        // Удалить папку (по ссылке сервер проверит право записи)
        menuItems.push({ text: "", isSeparator: true }); // text обязателен типом пункта, при isSeparator не читается
        menuItems.push({
            text: t("forms.cloud.actions.remove"),
            iconName: "trash",
            cssClasses: ["text-[var(--color-red)]"],
            onClick: () => removeFolderHandler(item.form, item.data)
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
