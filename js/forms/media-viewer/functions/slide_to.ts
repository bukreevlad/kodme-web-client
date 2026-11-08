// Импортируем functions
import { showMedia } from "./show_media.js";

// Импортируем типы
import type { MediaViewer } from "../index.js";

/**
 * ***************************************************************************
 * Анимация перелистывания трека в сторону и показ следующего/предыдущего
 * медиафайла после завершения перехода.
 * @param form - Экземпляр формы.
 * @param direction - Направление ["prev" | "next"].
 * @returns Переход к следующему или предыдущему слайду.
 * ***************************************************************************
 */
export async function slideTo(form: MediaViewer, direction: "prev" | "next"): Promise<void> {

    if (form.media.length <= 1 || form.isTransitioning) return;

    form.isTransitioning = true;
    form.gestureLocked = true;

    const track = form.elements.track;
    // Нет сцены — считаем ширину 0: анимация не сдвигается,
    // но следующий медиафайл всё равно показывается
    const w = form.elements.stage?.clientWidth ?? 0;
    const targetDX = direction === "next" ? -w : w;

    if (track) track.style.transition = "transform 0.3s cubic-bezier(0.2, 0, 0.2, 1)";
    if (track) track.style.transform = `translate3d(${targetDX}px, 0, 0)`;

    setTimeout(async () => {
        const newIndex = direction === "next" ? form.currentIndex + 1 : form.currentIndex - 1;

        await showMedia(form, newIndex);

        if (track) track.style.transition = "none";
        if (track) track.style.transform = `translate3d(0, 0, 0)`;

        requestAnimationFrame(() => {
            form.isTransitioning = false;
            form.gestureLocked = false;
        });
    }, 300);

}
