// Импортируем сторонние пакеты
import { RoomEvent, DisconnectReason } from "livekit-client";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем типы
import type { Call } from "../../index.js";
import { t } from "../../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * Обрыв связи с комнатой звонка.
 *
 * Три сценария:
 *   - пользователь сам закрыл форму — штатный выход, молчим;
 *   - комната закрыта/участник оттуда выкинут — звонок завершён, форма
 *     закрывается с сообщением;
 *   - соединение оборвалось по сети — LiveKit успел исчерпать попытки
 *     переподключения (события Reconnecting/Reconnected он обрабатывает
 *     сам), поэтому форма тоже закрывается, но с предупреждением.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function subscribeDisconnected(form: Call): void {

    try {

        form.room.on(RoomEvent.Disconnected, (reason) => {

            Logger.warn("🔌 [app][call]: Отключено:", reason);

            // Пользователь сам закрыл форму: это штатный выход, не показываем ошибку
            if (form.isClosing) return;

            // Комната закрыта или нас выкинули: звонок завершён с другой
            // стороны — сообщение стандартное «Звонок завершён»
            const isRoomEnded = reason === DisconnectReason.ROOM_DELETED
                || reason === DisconnectReason.PARTICIPANT_REMOVED;
            if (isRoomEnded) {

                form.endCall({
                    reason: "remote_hangup",
                    toast: t("forms.call.toasts.ended"),
                    toastType: "default"
                });
                return;

            }

            // ---------- NETWORK ----------
            // Соединение не восстановилось: предупреждаем и закрываемся —
            // держать форму без комнаты бессмысленно, а звонок на сервере
            // доживёт до вебхука и корректно завершится
            Logger.warn("🔌 [app][call]: Соединение потеряно, причина:", reason);

            form.endCall({
                reason: "connect_error",
                toast: t("forms.call.toasts.connection_failed"),
                toastType: "error"
            });
            // ---------- NETWORK ----------

        });

    } catch (error) {
        Logger.error(error);
    }

}
