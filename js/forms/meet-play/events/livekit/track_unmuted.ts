// Импортируем сторонние пакеты
import { RoomEvent } from "livekit-client";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем functions
import { updateParticipant } from "../../functions/update_participant.js";

// Импортируем типы
import type { MeetPlay } from "../../index.js";

/**
 * ***************************************************************************
 * subscribeTrackUnmuted - Участник снял mute с опубликованного трека.
 *
 * Само событие LiveKit ни на что не влияет: и плитку участника, и иконки
 * футера перерисовывает updateParticipant — он смотрит и на устройство,
 * и на блокировки организатора, поэтому возврат трека в работу виден
 * ровно так же, как и обычное включение микрофона.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function subscribeTrackUnmuted(form: MeetPlay): void {

    try {

        // Подписываемся на событие
        form.room?.on(RoomEvent.TrackUnmuted, (publication, participant) => {
            Logger.debug(`🎤 [LiveKit]: Участник ${participant.identity} включил ${publication.kind}`);

            updateParticipant(form, participant);
        });

    } catch (error) {
        Logger.error(error)
    }

}
