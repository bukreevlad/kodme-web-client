// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../../components/overlay/index.js";
import { createPopoverMenu } from "../../../components/overlay/popover_menu.js";

// Импортируем forms
import { BroadcastCreate } from "../../broadcast-create/index.js";
import { BroadcastsSettings } from "../../broadcasts-settings/index.js";

// Импортируем типы
import type { PopoverMenuItem } from "../../../components/overlay/popover_menu.js";
import type { Broadcasts } from "../index.js";

/**
 * ***************************************************************************
 * Контекстное меню шапки списка трансляций.
 * @param event - Событие клика.
 * @param form - Экземпляр формы.
 * @returns Promise без значения.
 ***************************************************************************
 */
export async function menuHandler(event: Event, form: Broadcasts): Promise<void> {

    try {

        // Определение списка элементов меню
        const menuItems: PopoverMenuItem[] = [];

        // menu item
        let addCast: PopoverMenuItem = {
            text: window._lc.forms.broadcasts.context_menu.create_cast,
            iconName: "Plus",
            onClick: () => new BroadcastCreate()
        }

        // menu item
        let settings: PopoverMenuItem = {
            text: window._lc.forms.broadcasts.context_menu.settings,
            iconName: "Settings",
            onClick: () => new BroadcastsSettings()
        };

        // Проверяем на отображение
        menuItems.push(addCast);
        menuItems.push(settings);

        // Отменяем стандартное контекстное меню браузера
        event.preventDefault();

        // Создание и открытие контекстного меню
        const contextMenu = new Overlay(createPopoverMenu(menuItems), {
            type: "popover",
            targetNode: form.tpl?.querySelector<HTMLElement>(":scope >.header [action-menu]"),
            targetNodeDirection: "bottom"
        });

        // Открываем меню
        contextMenu.open();

    } catch (error) {
        Logger.error(error);
    }

}
