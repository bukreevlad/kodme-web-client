// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../../components/toast.js";

// Импортируем forms
import { Main } from "../../../main/index.js";

// Импортируем requests
import { enableNotifyRequest } from "../../../messages/requests/enable_notify.js";

// Импортируем типы
import type { ChannelItem } from "../channel.js";

/**
 * ***************************************************************************
 * Включить уведомления канала.
 * @param channel - Строка канала.
 * ***************************************************************************
 */
export async function enableNotifyHandler(channel: ChannelItem): Promise<void> {

    try {

        // Запрос
        await enableNotifyRequest({ channel_id: channel.data.id });

        // Обновляем данные
        channel.data.is_notifications = true;
        Main.instance?.store.update(channel.data.id, channel.data);

        // Toast
        Toast.success(window._lc.forms.main.components.channels.context_menu.toasts.success_enable_notify, {
            position: "bottom-center"
        });

    } catch (error) {
        Logger.error(error);
    }

}
