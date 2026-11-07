// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { BroadcastPlay } from "../index.js";

/**
 * ***************************************************************************
 * STOP_FLV_PLAYER - остановка воспроизведения трансляции через FLV.
 *
 * Движок mpegts гасится только когда он действительно FLV: kind в
 * StreamEngine сужает union, а invariant — kind всегда равен текущему
 * typePlay, пока движок существует (см. types.ts).
 *
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function stopFLVPlayer(form: BroadcastPlay): void {

    try {

        // Отключаем движок flv
        const engine = form.streamEngine;
        if (engine?.kind === "flv") {

            // invariant: kind === typePlay, пока движок установлен
            engine.player.unload();
            engine.player.detachMediaElement();
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
