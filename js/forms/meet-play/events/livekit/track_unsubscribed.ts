// Импортируем сторонние пакеты
import { RoomEvent } from "livekit-client";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем типы
import type { MeetPlay } from "../../index.js";

/**
 * ***************************************************************************
 * subscribeTrackUnsubscribed - Отписан от трека участника: поток больше
 *                              не показываем.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function subscribeTrackUnsubscribed(form: MeetPlay): void {

    try {

        // Подписываемся на событие
        form.room?.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
            Logger.debug(`📡 [LiveKit]: Отписан от трека ${track.kind} от ${participant.identity}`);

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
