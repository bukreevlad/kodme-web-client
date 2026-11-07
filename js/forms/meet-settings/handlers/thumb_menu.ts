// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../../components/overlay/index.js";
import { createPopoverMenu } from "../../../components/overlay/popover_menu.js";

// Импортируем functions
import { choosePhoto } from "../functions/choose_photo.js";
import { removeThumb } from "../functions/remove_thumb.js";

// Импортируем типы
import type { PopoverMenuItem } from "../../../components/overlay/popover_menu.js";
import type { MeetSettings } from "../index.js";

/**
 * ***************************************************************************
 * Контекстное меню обложки: «Загрузить» (открывает выбор файла) и
 * «Удалить» (снимает ссылку на обложку).
 * @param event - Событие клика (стандартное меню браузера отменяется).
 * @param form - Экземпляр формы.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function thumbnailContextMenuHandler(event: Event, form: MeetSettings): Promise<void> {

    try {

        // Определение списка элементов меню
        const menuItems: PopoverMenuItem[] = [];

        // menu item
        const upload: PopoverMenuItem = {
            text: window._lc.forms.meet_settings.context_menu.upload,
            iconName: "Upload",
            onClick: () => choosePhoto(form)
        };

        // menu item
        const remove: PopoverMenuItem = {
            text: window._lc.forms.meet_settings.context_menu.remove,
            iconName: "trash",
            cssClasses: ["text-[var(--color-red)]"],
            onClick: () => removeThumb(form)
        };

        // Проверяем на отображение
        menuItems.push(upload);
        menuItems.push(remove);

        // Отменяем стандартное контекстное меню браузера
        event.preventDefault();

        // Создание и открытие контекстного меню
        const contextMenu = new Overlay(createPopoverMenu(menuItems), {
            type: "popover",
            targetNode: form.tpl?.querySelector<HTMLElement>(":scope >.content [action-choose-thumb]"),
            targetNodeDirection: "bottom"
        });

        // Открываем меню
        contextMenu.open();

    } catch (error) {
        Logger.error(error);
    }

}
