// Импортируем сторонние пакеты
import { RoomEvent, DisconnectReason } from "livekit-client";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { Toast } from "../../../../components/toast.js";

// Импортируем типы
import type { MeetPlay } from "../../index.js";

/**
 * ***************************************************************************
 * subscribeDisconnected - Обработка разрыва связи с комнатой.
 *
 * Различаем три сценария: участник вышел сам, его исключил организатор
 * или соединение оборвалось по сети. Раньше здесь был только Logger.warn,
 * из-за чего форма оставалась «живой» после обрыва.
 * @param form - Экземпляр формы.
 * @returns {void}
 * ***************************************************************************
 */
export function subscribeDisconnected(form: MeetPlay): void {

    try {

        form.room?.on(RoomEvent.Disconnected, (reason) => {

            Logger.warn("🔌 [LiveKit]: Отключено:", reason);

            // Пользователь сам закрыл форму: это штатный выход, не показываем ошибку
            if (form.isClosing) return;

            // ---------- REMOVED ----------
            // Организатор исключил участника из конференции
            if (reason === DisconnectReason.PARTICIPANT_REMOVED) {

                // Toast
                Toast.error(window._lc.forms.meet_play.toasts.you_were_removed, {
                    duration: 4000
                });

                // Закрываем форму: доступа к комнате больше нет
                form.modal?.close();
                return;
            }
            // ---------- REMOVED ----------

            // ---------- ROOM DELETED ----------
            // Комнату удалили на сервере — оставаться в ней бессмысленно
            if (reason === DisconnectReason.ROOM_DELETED) {

                // Toast
                Toast.error(window._lc.forms.meet_play.toasts.disconnected, {
                    duration: 4000
                });

                form.modal?.close();
                return;
            }
            // ---------- ROOM DELETED ----------

            // ---------- NETWORK ----------
            // Соединение отвалилось по сети: предупреждаем, но форму не закрываем,
            // пользователь может переподключиться сам.
            Toast.error(window._lc.forms.meet_play.toasts.disconnected, {
                duration: 4000
            });
            // ---------- NETWORK ----------

        });

    } catch (error) {
        Logger.error(error)
    }

}
