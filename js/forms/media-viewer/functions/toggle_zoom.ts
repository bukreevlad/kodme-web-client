// Импортируем functions
import { resetView } from "./reset_view.js";
import { applyTransform } from "./apply_transform.js";
import { updateGestureMode } from "./update_gesture_mode.js";

// Импортируем типы
import type { MediaViewer } from "../index.js";

/**
 * ***************************************************************************
 * Двойной тап: переключение между зумом по умолчанию и максимальным.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function toggleZoom(form: MediaViewer): void {

    if (form.zoom > 1) {
        resetView(form, true);
    } else {
        // maxZoom опционален в типе — конструктор задаёт по умолчанию 3
        form.zoom = form.options.maxZoom ?? 3;
        form.posX = 0;
        form.posY = 0;
        applyTransform(form, true);
    }

    updateGestureMode(form);

}
