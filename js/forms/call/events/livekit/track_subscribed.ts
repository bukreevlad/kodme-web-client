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
 * Трек участника подписан: поток дошёл и его можно показывать.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function subscribeTrackSubscribed(form: Call): void {

    try {

        form.room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
            Logger.debug(`📹 [app][call]: Подписан трек ${track?.kind} от ${participant?.identity}`);
            updateParticipant(form, participant);
        });

    } catch (error) {
        Logger.error(error);
    }

}
