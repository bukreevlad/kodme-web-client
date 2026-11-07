// Импортируем сторонние пакеты
import { RoomEvent } from "livekit-client";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем functions
import { updateConnectionQuality } from "../../functions/apply_connection_quality.js";

// Импортируем типы
import type { Call } from "../../index.js";

/**
 * ***************************************************************************
 * LiveKit сообщил об изменении качества связи.
 *
 * Событие приходит и для локального участника, и для удалённых, поэтому
 * уровень берём у того участника, который его прислал: индикатор в шапке
 * показывает качество именно нашей связи, и подменять его чужим было бы
 * враньём.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function subscribeConnectionQualityChanged(form: Call): void {

    try {

        form.room.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {

            // Чужая связь — не наша забота
            if (!form.room?.localParticipant) return;
            if (participant && participant.identity !== form.room.localParticipant.identity) return;

            updateConnectionQuality(form, quality);

        });

        // ---------- ПЕРВЫЙ ТИК ----------
        // Событие приходит с задержкой (нужна накопленная статистика),
        // а уровень на момент подключения в комнате уже есть. Без этого
        // у пользователя первые секунды пустая шапка
        const local = form.room?.localParticipant;
        if (local) {
            setTimeout(() => updateConnectionQuality(form, local.connectionQuality), 0);
        }

    } catch (error) {
        Logger.error("🚨 [app][call]: Не удалось подписаться на изменение качества связи:", error);
    }

}
