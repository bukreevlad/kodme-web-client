// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { resetView } from "../functions/reset_view.js";
import { applyTransform } from "../functions/apply_transform.js";
import { constrainPosition } from "../functions/constrain_position.js";
import { updateGestureMode } from "../functions/update_gesture_mode.js";

// Импортируем типы
import type { MediaViewer } from "../index.js";

/**
 * ***************************************************************************
 * Зум изображения колесом мыши над сценой.
 * @param event - Событие wheel.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function wheelHandler(event: WheelEvent, form: MediaViewer): void {

    try {

        // Без preventDefault страница под модалкой скроллилась бы вместе с зумом
        event.preventDefault();

        const delta = event.deltaY > 0 ? -0.3 : 0.3;
        const oldZoom = form.zoom;
        form.zoom = Math.min(Math.max(1, form.zoom + delta), form.options.maxZoom ?? 3);

        if (form.zoom !== oldZoom) {
            if (form.zoom === 1) {
                resetView(form, true);
            } else {
                constrainPosition(form);
                applyTransform(form, false);
            }
            updateGestureMode(form);
        }

    } catch (error) {
        Logger.error(error);
    }

}
