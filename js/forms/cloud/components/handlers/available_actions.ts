// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../../../components/overlay/index.js";
import { createPopoverMenu } from "../../../../components/overlay/popover_menu.js";

// Импортируем handlers формы
import { openAvailableLinkHandler } from "../../handlers/open_available_link.js";
import { removeAvailableLinkHandler } from "../../handlers/remove_available_link.js";

// Импортируем типы
import type { PopoverMenuInput } from "../../../../components/overlay/popover_menu.js";
import type { CloudAvailableItemHandle } from "../available_item.js";
import { t } from "../../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Контекстное меню «Доступное для меня»: открыть, удалить из списка.
 * @param event - Событие клика по кнопке действий.
 * @param item - Компонент доступной ссылки.
 * ***************************************************************************
 */
export async function openAvailableActions(event: MouseEvent, item: CloudAvailableItemHandle): Promise<void> {

    try {

        // Получение координат из события (меню открывается кликом мыши
        // или тачем — синтезированный click несёт clientX/clientY)
        let x = event.clientX || 0;
        let y = event.clientY || 0;

        // Определение списка элементов меню
        const menuItems: PopoverMenuInput[] = [];

        // ================================
        // Открыть ссылку
        menuItems.push({
            text: t("forms.cloud.actions.open"),
            iconName: "link",
            onClick: () => openAvailableLinkHandler(item.form, item.data)
        });

        // ================================
        // Удалить из «Доступное для меня»
        menuItems.push({ text: "", isSeparator: true }); // text обязателен типом пункта, при isSeparator не читается
        menuItems.push({
            text: t("forms.cloud.actions.remove"),
            iconName: "trash",
            cssClasses: ["text-[var(--color-red)]"],
            onClick: () => removeAvailableLinkHandler(item.form, item.data)
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
