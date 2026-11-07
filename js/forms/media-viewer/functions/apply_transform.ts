// Импортируем типы
import type { MediaViewer } from "../index.js";

/**
 * ***************************************************************************
 * Трансформация канваса активного слайда: сдвиг + масштаб (зум).
 * @param form - Экземпляр формы.
 * @param animate - Анимировать ли переход трансформации (по умолчанию false).
 * ***************************************************************************
 */
export function applyTransform(form: MediaViewer, animate = false): void {

    const el = form.elements.canvas;
    if (!el) return;

    el.style.transition = animate ? "transform 0.3s cubic-bezier(0.2, 0, 0.2, 1), opacity 0.3s" : "none";

    // При зуме 1 сдвиг не нужен — фото всегда по центру
    const x = form.zoom > 1 ? form.posX : 0;
    const y = form.zoom > 1 ? form.posY : 0;

    el.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${form.zoom})`;

}
