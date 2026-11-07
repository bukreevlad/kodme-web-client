// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../../components/overlay/index.js";
import { createPopoverMenu } from "../../../components/overlay/popover_menu.js";
import { Toast } from "../../../components/toast.js";

// Импортируем handlers
import { openSecretChatHandler } from "./open_secret_chat.js";
import { startSecretCallHandler } from "./secret_call.js";

// Импортируем requests
import { addContactRequest } from "../requests/add_contact.js";
import { removeContactRequest } from "../requests/remove_contact.js";

// Импортируем типы
import type { PopoverMenuItem } from "../../../components/overlay/popover_menu.js";
import type { UserProfile } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Контекстное меню «Ещё»: добавление или удаление пользователя из контактов
 * в зависимости от текущего флага is_contact.
 * @param event - Событие клика (стандартное меню браузера отменяется).
 * @param form - Экземпляр формы.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function contextMenuHandler(event: Event, form: UserProfile): Promise<void> {

    try {

        // Определение списка элементов меню
        const menuItems: PopoverMenuItem[] = [];

        // Профиль загружается до открытия формы — без него пунктов не строим
        const profile = form.profile;
        if (!profile) return;

        // menu item
        let secretChat: PopoverMenuItem = {
            text: t("forms.user_profile.context_menu.secret_chat"),
            iconName: "lock",
            onClick: () => openSecretChatHandler(form)
        };
        menuItems.push(secretChat);

        // menu item: секретный звонок (вызов уходит всем онлайн-устройствам)
        let secretCall: PopoverMenuItem = {
            text: t("forms.user_profile.context_menu.secret_call"),
            iconName: "phone",
            onClick: () => startSecretCallHandler(form)
        };
        menuItems.push(secretCall);

        // menu item
        let addContact: PopoverMenuItem = {
            text: t("forms.user_profile.context_menu.add_contact"),
            iconName: "UserPlus",
            onClick: async () => {

                try {

                    // Запрос
                    await addContactRequest({
                        contact_user_id: form.userId
                    });

                    // Обновляем данные формы
                    profile.is_contact = true;

                    // Toast
                    Toast.success(t("forms.user_profile.context_menu.toasts.contact_added"));

                } catch (error) {
                    Logger.error(error);

                    // Toast
                    Toast.error(t("forms.user_profile.context_menu.toasts.contact_add_error"));
                }

            }
        };

        // menu item
        let removeContact: PopoverMenuItem = {
            text: t("forms.user_profile.context_menu.remove_contact"),
            iconName: "UserMinus",
            cssClasses: ["text-[var(--color-red)]"],
            onClick: async () => {

                try {

                    // Запрос
                    await removeContactRequest({
                        contact_user_id: form.userId
                    });

                    // Обновляем данные формы
                    profile.is_contact = false;

                    // Toast
                    Toast.success(t("forms.user_profile.context_menu.toasts.contact_removed"));

                } catch (error) {
                    Logger.error(error);

                    // Toast
                    Toast.error(t("forms.user_profile.context_menu.toasts.contact_remove_error"));
                }

            }
        };

        // Проверяем на отображение
        if (!profile.is_contact) menuItems.push(addContact);
        if (profile.is_contact) menuItems.push(removeContact);

        // Отменяем стандартное контекстное меню браузера
        event.preventDefault();

        // Создание и открытие контекстного меню
        const contextMenu = new Overlay(createPopoverMenu(menuItems), {
            type: "popover",
            targetNode: form.tpl?.querySelector<HTMLElement>(":scope >.content [data-actions] [action-menu]") ?? null,
            targetNodeDirection: "bottom"
        });

        // Открываем меню
        contextMenu.open();

    } catch (error) {
        Logger.error(error);
    }

}
