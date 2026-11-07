// Импортируем сторонние пакеты
import { RoomEvent } from "livekit-client";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем типы
import type { MeetPlay } from "../../index.js";

/**
 * ***************************************************************************
 * subscribeParticipantMetadataChanged - Участник обновил свои метаданные
 *                                       (например, поднял руку).
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function subscribeParticipantMetadataChanged(form: MeetPlay): void {

    try {

        // Подписываемся на событие изменения метаданных участника
        form.room?.on(RoomEvent.ParticipantMetadataChanged, (metadata, participant) => {

            // ВНИМАНИЕ: LiveKit в payload кладёт ПРЕЖНЕЕ значение, а сам
            // `participant.metadata` к этому моменту уже новый. Поэтому в
            // лог пишем именно `participant.metadata` — иначе в отладке
            // видно ровно противоположное состояние (так приходит и
            // поднятая рука, см. 7.1).
            Logger.debug(`🔇 [LiveKit]: Участник ${participant.identity} обновил данные на ${participant.metadata}`);

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
