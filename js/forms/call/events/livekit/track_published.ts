// Импортируем сторонние пакеты
import { RoomEvent } from "livekit-client";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем functions
import { updateParticipant } from "../../functions/update_participant.js";

// Импортируем типы
import type { Call } from "../../index.js";

/**
 * ***************************************************************************
 * Участник опубликовал трек (включил камеру или микрофон).
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function subscribeTrackPublished(form: Call): void {

    try {

        form.room.on(RoomEvent.TrackPublished, (publication, participant) => {
            Logger.debug(`📹 [app][call]: Опубликован трек от ${participant?.identity}: ${publication?.kind}/${publication?.source}`);
            updateParticipant(form, participant);
        });

    } catch (error) {
        Logger.error(error);
    }

}
