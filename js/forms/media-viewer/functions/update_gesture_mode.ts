// Импортируем типы
import type { MediaViewer } from "../index.js";

/**
 * ***************************************************************************
 * Переключение режима жестов: пока картинка увеличена — свайпы отключены
 * (панорамирование пальцем), при зуме 1 — свайпы снова активны.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function updateGestureMode(form: MediaViewer): void {

    if (!form.gestures) return;

    // Отключенный свайп — это отсутствие опции: контроллер читает её по
    // truthiness, поэтому null приводим к undefined
    const swipe = form.zoom > 1 ? null : form._swipeConfig;
    form.gestures.opts.swipe = swipe ?? undefined;

}
