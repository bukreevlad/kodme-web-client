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
 * Участник снял публикацию трека (выключил камеру/микрофон).
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function subscribeTrackUnpublished(form: Call): void {

    try {

        form.room.on(RoomEvent.TrackUnpublished, (publication, participant) => {
            Logger.debug(`📹 [app][call]: Снята публикация трека у ${participant?.identity}`);
            updateParticipant(form, participant);
        });

    } catch (error) {
        Logger.error(error);
    }

}
