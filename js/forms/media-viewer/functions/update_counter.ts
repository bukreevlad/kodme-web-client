// Импортируем типы
import type { MediaViewer } from "../index.js";

/**
 * ***************************************************************************
 * Обновление счётчика «текущий / всего» под сценой.
 * При одном медиафайле счётчик скрывается.
 * @param form - Экземпляр формы.
 * ***************************************************************************
 */
export function updateCounter(form: MediaViewer): void {

    if (!form.elements.counter) return;

    if (form.media.length <= 1) {
        form.elements.counter.style.display = "none";
        return;
    }

    form.elements.counter.innerText = `${form.currentIndex + 1} / ${form.media.length}`;

}
