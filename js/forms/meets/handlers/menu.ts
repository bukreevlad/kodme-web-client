// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../../components/overlay/index.js";
import { createPopoverMenu } from "../../../components/overlay/popover_menu.js";

// Импортируем forms
import { MeetCreate } from "../../meet-create/index.js";

// Импортируем типы
import type { PopoverMenuItem } from "../../../components/overlay/popover_menu.js";
import type { Meets } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Контекстное меню шапки списка конференций.
 * @param event - Событие клика.
 * @param form - Экземпляр формы.
 * @returns Promise без значения.
 ***************************************************************************
 */
export async function menuHandler(event: Event, form: Meets): Promise<void> {

    try {

        // Определение списка элементов меню
        const menuItems: PopoverMenuItem[] = [];

        // menu item
        let addMeet: PopoverMenuItem = {
            text: t("forms.meets.context_menu.create_meet"),
            iconName: "Plus",
            onClick: () => new MeetCreate()
        };

        // Проверяем на отображение
        menuItems.push(addMeet);

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
