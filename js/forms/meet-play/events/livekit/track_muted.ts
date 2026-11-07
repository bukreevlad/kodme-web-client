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
 * subscribeTrackMuted - Участник заглушил опубликованный трек.
 *
 * Само событие LiveKit ни на что не влияет: и плитку участника, и иконки
 * футера перерисовывает updateParticipant — он смотрит и на устройство,
 * и на блокировки организатора, поэтому принудительный mute с сервера
 * отражается так же, как и действие самого участника.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function subscribeTrackMuted(form: MeetPlay): void {

    try {

        // Подписываемся на событие
        form.room?.on(RoomEvent.TrackMuted, (publication, participant) => {
            Logger.debug(`🔇 [LiveKit]: Участник ${participant.identity} выключил ${publication.kind}`);

            updateParticipant(form, participant);
        });

    } catch (error) {
        Logger.error(error)
    }

}
