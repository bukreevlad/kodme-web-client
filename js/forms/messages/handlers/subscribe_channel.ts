// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем forms
import { Main } from "../../main/index.js";

// Импортируем requests
import { subscribeChannelRequest } from "../requests/subscribe_channel.js";

// Импортируем типы
import type { Messages } from "../index.js";

/**
 * ***************************************************************************
 * Подписаться на канал и обновить Store главного экрана.
 * @param form - Экземпляр формы.
 * @returns Promise, завершающийся после обновления.
 * ***************************************************************************
 */
export async function subscribeChannelHandler(form: Messages): Promise<void> {

    try {

        // Запрос
        await subscribeChannelRequest({ channel_id: form.channelId });

        // Канал
        let channel = form.channel;
        if (channel) {

            // Обновляем данные
            channel.is_subscribed = true;

            // Обновляем Store
            let storeChannel = Main.instance?.store.get(channel.id);
            if (storeChannel) {
                Main.instance?.store.update(channel.id, channel);
            } else {
                Main.instance?.store.add(channel);
            }

        }

        // Toast
        Toast.success(window._lc.forms.messages.context_menu.toasts.success_subscribe, { position: "bottom-center" });

    } catch (error) {
        Logger.error(error);
    }

}
