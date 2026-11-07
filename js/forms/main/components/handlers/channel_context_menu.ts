// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../../../components/overlay/index.js";
import { createPopoverMenu } from "../../../../components/overlay/popover_menu.js";

// Импортируем forms
import { ChannelProfile } from "../../../channel-profile/index.js";
import { UserProfile } from "../../../user-profile/index.js";
import { Call } from "../../../call/index.js";

// Импортируем handlers
import { enableNotifyHandler } from "./enable_notify.js";
import { disableNotifyHandler } from "./disable_notify.js";
import { unsubscribeChannelHandler } from "./unsubscribe_channel.js";
import { removeDialogHandler } from "./remove_dialog.js";
import { clearHistoryHandler } from "./clear_history.js";
import { moveToFolderHandler } from "./move_to_folder.js";

// Импортируем типы
import type { PopoverMenuItem } from "../../../../components/overlay/popover_menu.js";
import type { ChannelItem } from "../channel.js";
import { t } from "../../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Контекстное меню строки канала.
 *
 * Пункты набираются по состоянию канала: уведомления — только для
 * подписанных, звонок и профиль собеседника — для диалогов, удаление и
 * очистка — для подписанных диалогов.
 * @param event - Событие контекстного меню (всегда мышное: событие
 *   `contextmenu` не бывает тач-событием).
 * @param channel - Строка канала, для которой открыто меню.
 * ***************************************************************************
 */
export async function channelContextMenuHandler(event: MouseEvent, channel: ChannelItem): Promise<void> {

    try {

        // Получение координат из события
        const x = event.clientX;
        const y = event.clientY;

        // Определение списка элементов меню
        const menuItems: PopoverMenuItem[] = [];

        // ================================

        // menu item
        const enableNotify: PopoverMenuItem = {
            text: t("forms.main.components.channels.context_menu.enable_notify"),
            iconName: "Bell",
            onClick: () => enableNotifyHandler(channel)
        };
        if (!channel.data.is_notifications && channel.data.is_subscribed
            && [1, 2, 3, 4, 6, 7, 8].includes(channel.data.type ?? -1)
        ) {
            menuItems.push(enableNotify);
        }

        // ================================

        // menu item
        const disableNotify: PopoverMenuItem = {
            text: t("forms.main.components.channels.context_menu.disable_notify"),
            iconName: "BellOff",
            onClick: () => disableNotifyHandler(channel)
        };
        if (channel.data.is_notifications && channel.data.is_subscribed
            && [1, 2, 3, 4, 6, 7, 8].includes(channel.data.type ?? -1)
        ) {
            menuItems.push(disableNotify);
        }

        // ================================

        // menu item
        const profile: PopoverMenuItem = {
            text: t("forms.main.components.channels.context_menu.profile"),
            iconName: "info-square-rounded",
            onClick: () => new ChannelProfile({ channelId: channel.data.id })
        };
        menuItems.push(profile);

        // ================================

        // menu item
        const userProfile: PopoverMenuItem = {
            text: t("forms.main.components.channels.context_menu.user_profile"),
            iconName: "User",
            onClick: () => {
                // Ссылки в замыкании читаются в момент клика
                const userId = channel.data?.display_user_id;
                if (!userId) return;
                new UserProfile({ userId });
            }
        };
        if (channel.data.type === 1) {
            menuItems.push(userProfile);
        }

        // ================================

        // menu item
        const call: PopoverMenuItem = {
            text: t("forms.main.components.channels.context_menu.call"),
            iconName: "PhoneOutgoing",
            onClick: () => new Call({
                userId: channel.data.display_user_id,
                displayName: channel.data.display_name,
                avatar: channel.data.avatar,
                isInitiator: true
            })
        };
        if (channel.data.type === 1) {
            menuItems.push(call);
        }

        // ================================

        // menu item
        const moveToFolder: PopoverMenuItem = {
            text: t("forms.main.components.channels.context_menu.add_to_folder"),
            iconName: "folder-open",
            onClick: () => moveToFolderHandler(channel)
        };
        if (channel.data.type !== 5) {
            menuItems.push(moveToFolder);
        }

        // ================================

        // menu item
        const unsubscribeChannel: PopoverMenuItem = {
            text: t("forms.main.components.channels.context_menu.unsubscribe_channel"),
            iconName: "user-minus",
            cssClasses: ["text-[var(--color-red)]"],
            onClick: () => unsubscribeChannelHandler(channel)
        };
        if (channel.data.type === 3 && channel.data.is_subscribed) {
            menuItems.push(unsubscribeChannel);
        }

        // ================================

        // menu item
        const unsubscribeGroup: PopoverMenuItem = {
            text: t("forms.main.components.channels.context_menu.unsubscribe_group"),
            iconName: "user-minus",
            cssClasses: ["text-[var(--color-red)]"],
            onClick: () => unsubscribeChannelHandler(channel)
        };
        if (channel.data.type === 2 && channel.data.is_subscribed) {
            menuItems.push(unsubscribeGroup);
        }

        // ================================

        // menu item
        const clearHistory: PopoverMenuItem = {
            text: t("forms.main.components.channels.context_menu.clear_history"),
            iconName: "history",
            cssClasses: ["text-[var(--color-red)]"],
            onClick: () => clearHistoryHandler(channel)
        };
        if ([1, 8].includes(channel.data.type ?? -1) && channel.data.is_subscribed) {
            menuItems.push(clearHistory);
        }

        // ================================

        // menu item
        const removeDialog: PopoverMenuItem = {
            text: t("forms.main.components.channels.context_menu.remove_dialog"),
            iconName: "trash",
            cssClasses: ["text-[var(--color-red)]"],
            onClick: () => removeDialogHandler(channel)
        };
        if ([1, 8].includes(channel.data.type ?? -1) && channel.data.is_subscribed) {
            menuItems.push(removeDialog);
        }

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
