// Импортируем functions
import { applyTransform } from "./apply_transform.js";
import { updateGestureMode } from "./update_gesture_mode.js";

// Импортируем типы
import type { MediaViewer } from "../index.js";

/**
 * ***************************************************************************
 * Сброс зума, панорамирования и состояния жестов к исходному виду.
 * @param form - Экземпляр формы.
 * @param animate - Анимировать ли возврат (по умолчанию true).
 * ***************************************************************************
 */
export function resetView(form: MediaViewer, animate = true): void {

    form.zoom = 1;
    form.posX = 0;
    form.posY = 0;
    form.tempDX = 0;
    form.tempDY = 0;
    form.gestureLocked = false;

    if (form.elements.canvas) {
        form.elements.canvas.style.opacity = "1";
        applyTransform(form, animate);
    }

    if (form.elements.track) {
        form.elements.track.style.transition = animate ? "transform 0.3s cubic-bezier(0.2, 0, 0.2, 1), opacity 0.3s" : "none";
        form.elements.track.style.transform = `translate3d(0, 0, 0)`;
        form.elements.track.style.opacity = "1";
    }

    updateGestureMode(form);

}
