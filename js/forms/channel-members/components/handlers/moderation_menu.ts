// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { readEventPoint } from "../../../../utils/dom/read_event_point.js";

// Импортируем functions
import { getSessionUserId } from "../../../main/functions/session_identity.js";

// Импортируем components
import { Overlay } from "../../../../components/overlay/index.js";
import { createPopoverMenu } from "../../../../components/overlay/popover_menu.js";

// Импортируем handlers
import { cleanUserMessagesHandler } from "./clean_user_messages.js";
import { banMemberHandler } from "./ban_member.js";
import { unbanMemberHandler } from "./unban_member.js";

// Импортируем типы
import type { PopoverMenuInput } from "../../../../components/overlay/popover_menu.js";
import type { ChannelMembers } from "../../index.js";
import type { MemberRecord } from "../../types.js";
import { t } from "../../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Открытие контекстного меню участника с пунктами модерации.
 *
 * Пункты показываются только при правах владельца или модератора с
 * нужным правом; цель должна отличаться от зрителя, не быть создателем
 * канала и не быть модератором — иначе меню не открывается.
 * @param form - Форма участников.
 * @param member - Участник, для которого открывается меню.
 * @param event - Событие (мышь или тач) — точка привязки меню.
 * ***************************************************************************
 */
export function openModerationMenu(form: ChannelMembers, member: MemberRecord, event: Event): void {

    try {

        // Права текущего пользователя читаем из канала формы (IndexedDB)
        const channel = form.channel;
        if (!channel) return;

        const sessionUserId = getSessionUserId();
        const isChannelOwner = channel.owner_id === sessionUserId;
        const canClean = isChannelOwner || (!!channel.is_moderator && !!channel.can_clean_messages);
        const canRestrict = isChannelOwner || (!!channel.is_moderator && !!channel.can_restrict_members);

        // Цель: не зритель, не создатель канала и не модератор
        const isTargetAllowed = member.user_id !== sessionUserId &&
            member.user_id !== channel.owner_id &&
            !member.is_moderator;

        // Прав нет или цель не подходит — меню не открываем
        if (!isTargetAllowed || (!canClean && !canRestrict)) return;

        // ================================

        const menuItems: PopoverMenuInput[] = [];

        // Удалить все сообщения участника
        if (canClean) {
            menuItems.push({
                text: t("forms.channel_members.context_menu.clean_user"),
                iconName: "eraser",
                cssClasses: ["text-[var(--color-red)]"],
                onClick: () => cleanUserMessagesHandler(form, member)
            });
        }

        // Забанить / разблокировать участника
        if (canRestrict) {
            if (member.is_banned) {
                menuItems.push({
                    text: t("forms.channel_members.context_menu.unban_user"),
                    iconName: "refresh",
                    onClick: () => unbanMemberHandler(form, member)
                });
            } else {
                menuItems.push({
                    text: t("forms.channel_members.context_menu.ban_user"),
                    iconName: "ban",
                    cssClasses: ["text-[var(--color-red)]"],
                    onClick: () => banMemberHandler(form, member)
                });
            }
        }

        // ================================

        // Точка привязки меню из события
        const point = readEventPoint(event);
        const x = point?.x ?? 0;
        const y = point?.y ?? 0;

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
