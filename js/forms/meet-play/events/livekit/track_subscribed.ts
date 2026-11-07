// Импортируем сторонние пакеты
import { RoomEvent } from "livekit-client";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем типы
import type { MeetPlay } from "../../index.js";

/**
 * ***************************************************************************
 * subscribeTrackSubscribed - Подписан на трек удалённого участника: поток
 *                            дошёл и его можно показывать.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function subscribeTrackSubscribed(form: MeetPlay): void {

    try {

        // Подписываемся на событие
        form.room?.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
            Logger.debug(`📡 [LiveKit]: Подписан на трек ${track.kind} от ${participant.identity}`);

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
