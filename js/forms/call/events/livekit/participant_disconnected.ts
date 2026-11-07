// Импортируем сторонние пакеты
import { RoomEvent } from "livekit-client";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем functions
import { syncStore } from "../../functions/sync_store.js";

// Импортируем типы
import type { Call } from "../../index.js";

/**
 * ***************************************************************************
 * Участник вышел из звонка.
 *
 * Если в комнате не осталось никого, кроме меня, — звонок завершён с другой
 * стороны, и форма закрывается с сообщением. Для группового звонка здесь
 * просто пересобирается сетка: выход одного участника звонок не рушит.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function subscribeParticipantDisconnected(form: Call): void {

    try {

        form.room.on(RoomEvent.ParticipantDisconnected, (participant) => {
            Logger.debug(`👋 [app][call]: Участник вышел: ${participant.identity}`);

            // ---------- ЗАВЕРШЕНИЕ ----------
            // Запоминаем состояние до пересинхронизации: после syncStore
            // callState уже не изменится, а вот список участников — да.
            // LiveKit шлёт событие ПОСЛЕ удаления участника из комнаты,
            // поэтому size === 0 здесь означает «я остался один»
            const wasActive = form.callState === "active";

            // Пересобираем список и раскладку
            syncStore(form);

            // Я остался один в разговоре — собеседник положил трубку
            if (wasActive && form.room.remoteParticipants.size === 0) {

                form.endCall({
                    reason: "remote_hangup",
                    toast: window._lc.forms.call.toasts.ended,
                    toastType: "default"
                });

            }
            // ---------- ЗАВЕРШЕНИЕ ----------

        });

    } catch (error) {
        Logger.error(error);
    }

}
