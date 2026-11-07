// Импортируем сторонние пакеты
import { RoomEvent } from "livekit-client";
import type { Participant, RemoteParticipant } from "livekit-client";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем типы
import type { MeetPlay } from "../../index.js";

/**
 * ***************************************************************************
 * subscribeActiveSpeakersChanged - Обновление индикатора речи участников.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function subscribeActiveSpeakersChanged(form: MeetPlay): void {

    try {

        // Подписываемся на событие
        form.room?.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {

            // Обрабатываем удаленных участников
            form.room?.remoteParticipants.forEach((p) => {
                const isSpeaking = speakers.some(s => s.identity === p.identity);
                updateStoreIfChanged(form, p, isSpeaking);
            });

            // Обрабатываем себя (LocalParticipant)
            const local = form.room?.localParticipant;
            if (local) {
                const localIsSpeaking = speakers.some(s => s.identity === local.identity);
                updateStoreIfChanged(form, local, localIsSpeaking);
            }

        });

    } catch (error) {
        Logger.error(error)
    }

}

/**
 * ***************************************************************************
 * updateStoreIfChanged - Обновляет участника в хранилище, только если его
 *                        состояние речи реально изменилось.
 *
 * Чтобы не спамить событиями в Store и не перерисовывать DOM зря.
 * @param form - Экземпляр формы.
 * @param participant - Участник LiveKit.
 * @param isSpeaking - Говорит ли участник сейчас.
 * @returns {void}
 * ***************************************************************************
 */
function updateStoreIfChanged(
    form: MeetPlay,
    participant: Participant | RemoteParticipant,
    isSpeaking: boolean
): void {

    const data = form.store.get(participant.identity);

    if (data && data.isSpeaking !== isSpeaking) {
        data.isSpeaking = isSpeaking;
        form.store.update(participant.identity, data);
    }

}
