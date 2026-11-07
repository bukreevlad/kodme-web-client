// Импортируем сторонние пакеты
import { RoomEvent } from "livekit-client";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../../components/toast.js";

// Импортируем типы
import type { MeetPlay } from "../../index.js";

/**
 * ***************************************************************************
 * subscribeReconnected - Связь с комнатой восстановлена после
 *                        переподключения.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function subscribeReconnected(form: MeetPlay): void {

    try {

        form.room?.on(RoomEvent.Reconnected, () => {

            Logger.info("✅ [LiveKit]: Соединение восстановлено");

            // Пользователь сам закрыл форму: тост не нужен
            if (form.isClosing) return;

            // Toast
            Toast.success(window._lc.forms.meet_play.toasts.reconnected);

        });

    } catch (error) {
        Logger.error(error)
    }

}
