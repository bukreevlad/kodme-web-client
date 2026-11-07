// Импортируем handlers
import { wideHandler } from "../handlers/wide.js";

// Импортируем типы
import type { BroadcastPlay } from "../index.js";

/**
 * ***************************************************************************
 * PLAYER_EVENTS - подписки на события плеера трансляции.
 *
 * Контракт глобальной координации медиа («кто сейчас играет») общий для всего
 * приложения и должен сохраняться 1:1 — от него зависят остальные плееры.
 *
 * @param form - Экземпляр формы BroadcastPlay.
 * ***************************************************************************
 */
export function playerEvents(form: BroadcastPlay): void {

    // Событие при начале проигрывания
    form.player?.on("play", () => {
        window.dispatchEvent(new CustomEvent("[app][audio]::media-play", {
            detail: {
                type: "video",
                id: form.cast?.id
            }
        }));
    });

    // Переключатель ширины сцены в контролах плеера: плеер шлет новое
    // состояние, а форма переводит атрибут data-video-wide на корне
    form.player?.on("wide-toggle", (wide) => wideHandler(form, wide === true));

}
