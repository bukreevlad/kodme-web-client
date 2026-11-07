// Импортируем сторонние пакеты
import { RoomEvent } from "livekit-client";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../../components/toast.js";

// Импортируем типы
import type { MeetPlay } from "../../index.js";
import { t } from "../../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * subscribeReconnecting - LiveKit начал переподключение после обрыва связи.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function subscribeReconnecting(form: MeetPlay): void {

    try {

        form.room?.on(RoomEvent.Reconnecting, () => {

            Logger.warn("🔄 [LiveKit]: Потеряно соединение, переподключаемся...");

            // Пользователь сам закрыл форму: переподключаться незачем
            if (form.isClosing) return;

            // Toast
            Toast.warning(t("forms.meet_play.toasts.reconnecting"));

        });

    } catch (error) {
        Logger.error(error)
    }

}
