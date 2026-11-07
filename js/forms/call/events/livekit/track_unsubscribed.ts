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
 * Подписка на трек снята: поток ушёл, его нужно убрать с экрана.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function subscribeTrackUnsubscribed(form: Call): void {

    try {

        form.room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
            Logger.debug(`📹 [app][call]: Отписан трек ${track?.kind} от ${participant?.identity}`);
            updateParticipant(form, participant);
        });

    } catch (error) {
        Logger.error(error);
    }

}
