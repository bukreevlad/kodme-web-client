// Импортируем типы
import type { MediaViewer } from "../index.js";

/**
 * ***************************************************************************
 * Уничтожение видеоплеера и освобождение связанных с ним ресурсов.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function destroyPlayer(form: MediaViewer): void {

    // Останавливаем и сносим экземпляр VideoPlayer
    if (form.player) {
        try { form.player.pause(); } catch (e) { }
        try { form.player.detachRenditions(); } catch (e) { }
        try { form.player.destroy(); } catch (e) { }
        form.player = null;
    }

    // Отвязываем тег видео: снимаем src и <source>, но НЕ вызываем load().
    // Элемент всё равно будет удалён (пересборка слота или закрытие модалки),
    // а вызов load() после revokeObjectURL порождает в консоли
    // "GET blob:... ERR_FILE_NOT_FOUND".
    if (form.videoNode) {
        const video = form.videoNode;
        form.videoNode = null;
        try {
            video.removeAttribute("src");
            video.querySelectorAll("source").forEach((source) => source.remove());
        } catch (e) { }
    }

    // Освобождаем blob локального файла, если он был создан для этого видео
    if (form._mediaBlobUrl) {
        try { URL.revokeObjectURL(form._mediaBlobUrl); } catch (e) { }
        form._mediaBlobUrl = null;
    }

}
