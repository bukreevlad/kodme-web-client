// Импортируем сторонние пакеты
import { RoomEvent } from "livekit-client";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем типы
import type { MeetPlay } from "../../index.js";

/**
 * ***************************************************************************
 * subscribeTrackUnpublished - Удаленный участник перестал публиковать трек
 *                             (камера/микрофон выключены).
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function subscribeTrackUnpublished(form: MeetPlay): void {

    try {

        // Подписываемся на событие
        form.room?.on(RoomEvent.TrackUnpublished, (publication, participant) => {
            Logger.debug(`🔇 [LiveKit]: Участник ${participant.identity} выключил трек`);

            // Если участник есть в сторе — просто обновляем его, передавая его же инстанс
            if (form.store.get(participant.identity)) {
                form.store.update(participant.identity, {
                    id: participant.identity,
                    participant: participant
                });
            }

        });

    } catch (error) {
        Logger.error(error)
    }

}
