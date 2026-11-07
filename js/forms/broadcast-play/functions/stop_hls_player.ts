// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { BroadcastPlay } from "../index.js";

/**
 * ***************************************************************************
 * STOP_HLS_PLAYER - остановка воспроизведения трансляции через HLS.
 *
 * Движок hls.js гасится только когда он действительно HLS: kind в
 * StreamEngine сужает union, а invariant — kind всегда равен текущему
 * typePlay, пока движок существует (см. types.ts).
 *
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function stopHLSPlayer(form: BroadcastPlay): void {

    try {

        // Отключаем движок hls
        const engine = form.streamEngine;
        if (engine?.kind === "hls") {

            // Сначала отпускаем адаптер уровней: Video.js перестаёт
            // считать медиа «умеющим renditions» до уничтожения hls.js
            form.player?.detachHls();

            // invariant: kind === typePlay, пока движок установлен
            engine.player.destroy();
            form.streamEngine = null;
        }

        // Отключаем видео элемент
        if (form.video) {
            form.video.pause();
            form.video.removeAttribute("src");
        }

        // Отключаем таймеры (таймер может быть не запущен — снимать нечего)
        if (form.castTiming !== null) clearInterval(form.castTiming);
        form.castTiming = null;

    } catch (error) {
        Logger.error(error);
    }

}
