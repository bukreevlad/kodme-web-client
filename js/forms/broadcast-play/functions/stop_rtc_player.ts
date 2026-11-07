// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { BroadcastPlay } from "../index.js";

/**
 * ***************************************************************************
 * STOP_RTC_PLAYER - остановка RTC-соединения трансляции (WHEP).
 *
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function stopRTCPlayer(form: BroadcastPlay): void {

    try {

        // Отключаем видео элемент.
        // form.video — геттер формы, отдаёт нативный <video> из VideoPlayer.
        if (form.video) {
            form.video.pause();
            form.video.removeAttribute("src");
            form.video.srcObject = null;
        }

        // Закрываем peer соединение
        if (form.peerConnection) {
            form.peerConnection.close();
            form.peerConnection = null;
        }

        // Отключаем таймеры (таймер может быть не запущен — снимать нечего)
        if (form.rtcStatTiming !== null) clearInterval(form.rtcStatTiming);
        form.rtcStatTiming = null;
        if (form.castTiming !== null) clearInterval(form.castTiming);
        form.castTiming = null;

    } catch (error) {
        Logger.error(error);
    }

}
