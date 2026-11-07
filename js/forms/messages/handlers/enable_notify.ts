// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем forms
import { Main } from "../../main/index.js";

// Импортируем requests
import { enableNotifyRequest } from "../requests/enable_notify.js";

// Импортируем типы
import type { Messages } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Включить уведомления канала и обновить Store главного экрана.
 * @param form - Экземпляр формы.
 * @returns Promise, завершающийся после обновления.
 * ***************************************************************************
 */
export async function enableNotifyHandler(form: Messages): Promise<void> {

    try {

        // Запрос
        await enableNotifyRequest({ channel_id: form.channelId });

        // Канал
        let channel = form.channel;

        // Обновляем данные
        if (channel) {
            channel.is_notifications = true;
            Main.instance?.store.update(channel.id, channel);
        }

        // Toast
        Toast.success(t("forms.messages.context_menu.toasts.success_enable_notify"), { position: "bottom-center" });

    } catch (error) {
        Logger.error(error);
    }

}
