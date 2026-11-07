// Импортируем сторонние пакеты
import { RoomEvent } from "livekit-client";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем типы
import type { MeetPlay } from "../../index.js";

/**
 * ***************************************************************************
 * subscribeAudioPlaybackStatusChanged - Обработка блокировки звука браузером
 *                                       (Autoplay).
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function subscribeAudioPlaybackStatusChanged(form: MeetPlay): void {

    try {

        // Подписываемся на событие
        form.room?.on(RoomEvent.AudioPlaybackStatusChanged, () => {
            if (!form.room?.canPlaybackAudio) {
                Logger.warn("🔇 [LiveKit]: Звук заблокирован браузером! Нужно взаимодействие.");
            }
        });

    } catch (error) {
        Logger.error(error)
    }

}
