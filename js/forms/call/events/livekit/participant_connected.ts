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
 * Новый участник зашёл в звонок.
 *
 * На этом событии звонок обычно и «состоялся»: у инициатора это момент
 * ответа приглашённого. Перевод в состояние active выполняет syncStore.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function subscribeParticipantConnected(form: Call): void {

    try {

        // Подписываемся на событие
        form.room.on(RoomEvent.ParticipantConnected, (participant) => {
            Logger.debug(`👋 [app][call]: Новый участник зашёл: ${participant.identity}`);
            syncStore(form);
        });

    } catch (error) {
        Logger.error(error);
    }

}
