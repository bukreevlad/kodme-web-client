// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../../components/overlay/index.js";
import { createPopoverMenu } from "../../../components/overlay/popover_menu.js";

// Импортируем functions
import { choosePhoto } from "../functions/choose_photo.js";
import { removePhoto } from "../functions/remove_photo.js";

// Импортируем типы
import type { PopoverMenuItem } from "../../../components/overlay/popover_menu.js";
import type { BotSettings } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Контекстное меню аватара бота: «Загрузить» (открывает выбор фото)
 * и «Удалить» (снимает ссылку на аватар).
 * @param event - Событие клика (стандартное меню браузера отменяется).
 * @param form - Экземпляр формы.
 ***************************************************************************
 */
export function avatarContextMenuHandler(event: Event, form: BotSettings): void {

    try {

        // Определение списка элементов меню
        const menuItems: PopoverMenuItem[] = [

            // Загрузка фото
            {
                text: t("forms.bot_settings.context_menu.upload_avatar"),
                iconName: "Upload",
                onClick: () => choosePhoto(form)
            },

            // Удаление аватара
            {
                text: t("forms.bot_settings.context_menu.remove_avatar"),
                iconName: "trash",
                cssClasses: ["text-[var(--color-red)]"],
                onClick: () => removePhoto(form)
            }

        ];

        // Отменяем стандартное контекстное меню браузера
        event.preventDefault();

        // Создание и открытие контекстного меню
        const contextMenu = new Overlay(createPopoverMenu(menuItems), {
            type: "popover",
            targetNode: form.tpl?.querySelector(":scope >.content [action-choose-photo]") ?? null,
            targetNodeDirection: "bottom"
        });

        // Открываем меню
        contextMenu.open();

    } catch (error) {
        Logger.error(error);
    }

}
