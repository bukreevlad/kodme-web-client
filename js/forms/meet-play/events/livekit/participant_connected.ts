// Импортируем сторонние пакеты
import { RoomEvent } from "livekit-client";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем functions
import { syncStore } from "../../functions/sync_store.js";

// Импортируем типы
import type { MeetPlay } from "../../index.js";

/**
 * ***************************************************************************
 * subscribeParticipantConnected - Участник подключился к комнате.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function subscribeParticipantConnected(form: MeetPlay): void {

    try {

        // Подписываемся на событие - участник подключился
        form.room?.on(RoomEvent.ParticipantConnected, (participant) => {
            Logger.debug(`👋 [LiveKit]: Новый участник зашел: ${participant.identity}`);
            syncStore(form);
        });

    } catch (error) {
        Logger.error(error)
    }

}
