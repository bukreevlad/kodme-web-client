// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../../components/overlay/index.js";
import { createPopoverMenu } from "../../../components/overlay/popover_menu.js";
import type { PopoverMenuItem } from "../../../components/overlay/popover_menu.js";

// Импортируем forms
import { ChannelProfile } from "../../channel-profile/index.js";
import { UserProfile } from "../../user-profile/index.js";
import { Call } from "../../call/index.js";

// Импортируем handlers
import { enableNotifyHandler } from "./enable_notify.js";
import { disableNotifyHandler } from "./disable_notify.js";
import { subscribeChannelHandler } from "./subscribe_channel.js";
import { unsubscribeChannelHandler } from "./unsubscribe_channel.js";
import { clearHistoryHandler } from "./clear_history.js";
import { removeDialogHandler } from "./remove_dialog.js";
import { moveToFolderHandler } from "./move_to_folder.js";

// Импортируем типы
import type { Messages } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Открыть контекстное меню чата: пункты зависят от типа канала и подписки.
 * @param event - Событие вызова (клик по кнопке меню).
 * @param form - Экземпляр формы.
 * @returns Promise, завершающийся после открытия меню.
 * ***************************************************************************
 */
export async function contextMenuHandler(event: Event, form: Messages): Promise<void> {

    try {

        // Если нет формы или канал не загружен — меню построить не из чего
        if (!form) return;
        if (!form.channel) return;

        // Определение списка элементов меню
        const menuItems: PopoverMenuItem[] = [];

        // menu item
        let enableNotify: PopoverMenuItem = {
            text: t("forms.messages.context_menu.enable_notify"),
            iconName: "Bell",
            onClick: () => enableNotifyHandler(form)
        };
        if (!form.channel.is_notifications && form.channel.is_subscribed
            && [1, 2, 3, 4, 6, 7, 8].includes(form.channel.type)
        ) {
            menuItems.push(enableNotify);
        }

        // menu item
        let disableNotify: PopoverMenuItem = {
            text: t("forms.messages.context_menu.disable_notify"),
            iconName: "BellOff",
            onClick: () => disableNotifyHandler(form)
        };
        if (form.channel.is_notifications && form.channel.is_subscribed
            && [1, 2, 3, 4, 6, 7, 8].includes(form.channel.type)
        ) {
            menuItems.push(disableNotify);
        }

        // menu item
        let profile: PopoverMenuItem = {
            text: t("forms.messages.context_menu.profile"),
            iconName: "info-square-rounded",
            onClick: () => new ChannelProfile({ channelId: form.channelId })
        };
        menuItems.push(profile);

        // ================================

        // menu item
        let userProfile: PopoverMenuItem = {
            text: t("forms.messages.context_menu.user_profile"),
            iconName: "User",
            onClick: () => {
                // Ссылки в замыкании читаются в момент клика
                const channel = form.channel;
                if (!channel?.display_user_id) return;
                new UserProfile({ userId: channel.display_user_id });
            }
        };
        if (form.channel.type === 1) {
            menuItems.push(userProfile);
        }

        // menu item
        let call: PopoverMenuItem = {
            text: t("forms.messages.context_menu.call"),
            iconName: "PhoneOutgoing",
            onClick: () => {
                // Ссылки в замыкании читаются в момент клика
                const channel = form.channel;
                if (!channel) return;
                new Call({
                    userId: channel.display_user_id,
                    displayName: channel.display_name,
                    avatar: channel.avatar,
                    isInitiator: true
                });
            }
        };
        if (form.channel.type === 1) {
            menuItems.push(call);
        }

        // ================================

        // menu item
        let moveToFolder: PopoverMenuItem = {
            text: t("forms.messages.context_menu.add_to_folder"),
            iconName: "folder-open",
            onClick: () => {
                // Ссылка в замыкании читается в момент клика
                const channel = form.channel;
                if (channel) moveToFolderHandler(channel);
            }
        };
        if (form.channel.type !== 5) {
            menuItems.push(moveToFolder);
        }

        // menu item
        let subscribeChannel: PopoverMenuItem = {
            text: t("forms.messages.context_menu.subscribe_channel"),
            iconName: "user-plus",
            onClick: () => subscribeChannelHandler(form)
        };
        if (form.channel.type === 3 && !form.channel.is_subscribed) {
            menuItems.push(subscribeChannel);
        }

        // menu item
        let unsubscribeChannel: PopoverMenuItem = {
            text: t("forms.messages.context_menu.unsubscribe_channel"),
            iconName: "user-minus",
            cssClasses: ["text-[var(--color-red)]"],
            onClick: () => unsubscribeChannelHandler(form)
        };
        if (form.channel.type === 3 && form.channel.is_subscribed) {
            menuItems.push(unsubscribeChannel);
        }

        // menu item
        let subscribeGroup: PopoverMenuItem = {
            text: t("forms.messages.context_menu.subscribe_group"),
            iconName: "user-plus",
            onClick: () => subscribeChannelHandler(form)
        };
        if (form.channel.type === 2 && !form.channel.is_subscribed) {
            menuItems.push(subscribeGroup);
        }

        // menu item
        let unsubscribeGroup: PopoverMenuItem = {
            text: t("forms.messages.context_menu.unsubscribe_group"),
            iconName: "user-minus",
            cssClasses: ["text-[var(--color-red)]"],
            onClick: () => unsubscribeChannelHandler(form)
        };
        if (form.channel.type === 2 && form.channel.is_subscribed) {
            menuItems.push(unsubscribeGroup);
        }

        // menu item
        let clearHistory: PopoverMenuItem = {
            text: t("forms.messages.context_menu.clear_history"),
            iconName: "history",
            cssClasses: ["text-[var(--color-red)]"],
            onClick: () => clearHistoryHandler(form)
        };
        if ([1, 8].includes(form.channel.type) && form.channel.is_subscribed) {
            menuItems.push(clearHistory);
        }

        // menu item
        let removeDialog: PopoverMenuItem = {
            text: t("forms.messages.context_menu.remove_dialog"),
            iconName: "trash",
            cssClasses: ["text-[var(--color-red)]"],
            onClick: () => removeDialogHandler(form)
        };
        if ([1, 8].includes(form.channel.type) && form.channel.is_subscribed) {
            menuItems.push(removeDialog);
        }

        // Отменяем стандартное контекстное меню браузера
        event.preventDefault();

        // Создание и открытие контекстного меню
        const contextMenu = new Overlay(createPopoverMenu(menuItems), {
            type: "popover",
            targetNode: form.tpl?.querySelector<HTMLElement>(":scope >.header [action-context-menu]") ?? null,
            targetNodeDirection: "bottom"
        });

        // Открываем меню
        contextMenu.open();

    } catch (error) {
        Logger.error(error);
    }

}
