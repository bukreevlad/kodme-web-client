// Импортируем сторонние пакеты
import { RoomEvent } from "livekit-client";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем functions
import { applyRoomState } from "../../functions/apply_room_state.js";

// Импортируем типы
import type { MeetPlay } from "../../index.js";

/**
 * ***************************************************************************
 * subscribeRoomMetadataChanged - Состояние комнаты изменилось: организатор
 *          заблокировал источник участнику или сменил принудительный режим
 *          сетки.
 *
 * Блокировки и режим сетки хранятся в `room.metadata`,
 * поэтому этот канал — единственный источник обновлений: отдельный
 * сокет-push не нужен и не мог бы пережить переподключение участника.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function subscribeRoomMetadataChanged(form: MeetPlay): void {

    try {

        // Подписываемся на событие
        form.room?.on(RoomEvent.RoomMetadataChanged, async () => {

            Logger.debug("📡 [LiveKit]: Состояние комнаты изменилось");

            // Применяем новое состояние
            await applyRoomState(form, form.room?.metadata);

        });

    } catch (error) {
        Logger.error(error);
    }

}
