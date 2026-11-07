// Импортируем типы
import type { MediaPlayDetail } from "../types.js";
import type { MediaViewer } from "../index.js";

/**
 * ***************************************************************************
 * GlobalEvents - глобальные подписки просмотрщика медиа.
 *
 * Слушает системное событие старта любого медиа (аудио/видео в других
 * местах приложения) и ставит активное видео просмотрщика на паузу.
 * ***************************************************************************
 */
export class GlobalEvents {

    /**
     * *************************************************************************
     * Подписка на глобальное событие воспроизведения медиа.
     * @param form - Экземпляр формы.
     * *************************************************************************
     */
    static init(form: MediaViewer): void {

        // Защита от повторной подписки при повторных открытиях
        if (form._hasGlobalEvents) return;
        form._hasGlobalEvents = true;

        // Гасим видео просмотрщика, если в другом месте стартует своё медиа
        const handler = (event: CustomEvent<MediaPlayDetail>): void => {
            if (!form.player) return;
            const currentData = form.media[form.currentIndex];
            if (!currentData) return;

            if (event.detail.type === "audio" || (event.detail.type === "video" && event.detail.id !== currentData.id)) {
                form.player.pause();
            }
        };

        form.boundMediaPlayHandler = handler;
        window.addEventListener("[app][audio]::media-play", handler);

    }

    /**
     * *************************************************************************
     * Отписка от глобального события воспроизведения медиа.
     * @param form - Экземпляр формы.
     * *************************************************************************
     */
    static destroy(form: MediaViewer): void {

        if (!form.boundMediaPlayHandler) return;

        window.removeEventListener("[app][audio]::media-play", form.boundMediaPlayHandler);
        form.boundMediaPlayHandler = null;
        form._hasGlobalEvents = false;

    }

}
