// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { detachOmeRenditions } from "./ome_renditions_control.js";

// Импортируем типы
import type { BroadcastPlay } from "../index.js";

/**
 * ***************************************************************************
 * STOP_RTC_PLAYER - остановка воспроизведения трансляции через WebRTC.
 *
 * Сессии сигналинга сообщается stop (если id уже получен), затем
 * WebSocket и PeerConnection закрываются. Сервер OvenMediaEngine
 * дополнительно чистит сессию сам при разрыве WebSocket.
 *
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function stopRTCPlayer(form: BroadcastPlay): void {

    try {

        const socket = form.rtcSocket;
        const pc = form.peerConnection;

        // Сообщаем серверу о завершении: без id команда не имеет смысла,
        // а при разрыве соединения сервер вызывает обработчик закрытия сам
        if (socket && socket.readyState === WebSocket.OPEN && form.rtcSessionId !== null) {
            try {
                socket.send(JSON.stringify({ command: "stop", id: form.rtcSessionId }));
            } catch (error) {
                Logger.warn("[broadcast-play][rtc] не удалось отправить stop:", error);
            }
        }

        // Закрываем WebSocket
        if (socket) {
            // Сбрасываем обработчики, чтобы onclose не дёргал stop повторно
            socket.onmessage = null;
            socket.onclose = null;
            socket.onerror = null;
            socket.close();
            form.rtcSocket = null;
        }

        // Закрываем PeerConnection
        if (pc) {
            try {
                pc.close();
            } catch (error) {
                Logger.warn("[broadcast-play][rtc] ошибка закрытия PeerConnection:", error);
            }
            form.peerConnection = null;
        }

        form.rtcSessionId = null;

        // Снимаем адаптер качества: без этого пункт меню остался бы
        // в панели плеера после остановки WebRTC-воспроизведения
        detachOmeRenditions(form);

        // Отключаем видео элемент
        if (form.video) {
            form.video.pause();
            form.video.removeAttribute("src");
            form.video.srcObject = null;
        }

        // Отключаем таймеры (таймер может быть не запущен — снимать нечего)
        if (form.castTiming !== null) clearInterval(form.castTiming);
        form.castTiming = null;

    } catch (error) {
        Logger.error(error);
    }

}
