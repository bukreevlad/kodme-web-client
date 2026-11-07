// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем forms
import { Main } from "../../main/index.js";

// Импортируем requests
import { disableNotifyRequest } from "../requests/disable_notify.js";

// Импортируем типы
import type { Messages } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Отключить уведомления канала и обновить Store главного экрана.
 * @param form - Экземпляр формы.
 * @returns Promise, завершающийся после обновления.
 * ***************************************************************************
 */
export async function disableNotifyHandler(form: Messages): Promise<void> {

    try {

        // Запрос
        await disableNotifyRequest({ channel_id: form.channelId });

        // Канал
        let channel = form.channel;

        // Обновляем данные
        if (channel) {
            channel.is_notifications = false;
            Main.instance?.store.update(channel.id, channel);
        }

        // Toast
        Toast.success(t("forms.messages.context_menu.toasts.success_disable_notify"), { position: "bottom-center" });

    } catch (error) {
        Logger.error(error);
    }

}
