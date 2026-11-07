// Импортируем типы
import type { MediaItem } from "../types.js";
import type { MediaViewer } from "../index.js";

/**
 * ***************************************************************************
 * Подписка на события созданного плеера: старт воспроизведения видео
 * оповещает систему, чтобы фоновое аудио поставилось на паузу.
 * @param form - Экземпляр формы.
 * @param data - Данные текущего медиафайла.
 * ***************************************************************************
 */
export function subscribePlayerEvents(form: MediaViewer, data: MediaItem): void {

    // Видео начало воспроизведение — сообщаем всем остальным плеерам
    form.player?.on("play", () => {
        window.dispatchEvent(new CustomEvent("[app][audio]::media-play", {
            detail: { type: "video", id: data.id }
        }));
    });

}
