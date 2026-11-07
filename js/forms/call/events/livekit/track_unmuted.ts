// Импортируем сторонние пакеты
import { RoomEvent, isLocalParticipant, isRemoteParticipant } from "livekit-client";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем functions
import { updateParticipant } from "../../functions/update_participant.js";

// Импортируем типы
import type { Call } from "../../index.js";

/**
 * ***************************************************************************
 * Снято заглушение трека (включили микрофон).
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function subscribeTrackUnmuted(form: Call): void {

    try {

        form.room.on(RoomEvent.TrackUnmuted, (publication, participant) => {

            // События LiveKit типизируют участника как базовый Participant —
            // сужаем до локального/удалённого, которых ждёт updateParticipant
            if (isLocalParticipant(participant) || isRemoteParticipant(participant)) {
                updateParticipant(form, participant);
            }
        });

    } catch (error) {
        Logger.error(error);
    }

}
