// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../../components/toast.js";

// Импортируем типы
import type { ChannelInvite } from "../../types.js";
import { t } from "../../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Копирование ссылки приглашения в буфер обмена.
 * @param item - Данные приглашения строки списка.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function copyInviteHandler(item: ChannelInvite): Promise<void> {

    try {

        // Копируем ссылку
        navigator.clipboard.writeText(`${window.location.protocol}//${window.location.hostname}/+${item.link}`)
            .then(() => {
                Toast.success(t("forms.channel_manage_invites.components.toasts.success_copy"), { position: "bottom-center" });
            });

    } catch (error) {
        Logger.error(error);
    }

}
