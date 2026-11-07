// Импортируем functions
import { resetView } from "./reset_view.js";
import { renderSlot } from "./render_slot.js";
import { destroyPlayer } from "./destroy_player.js";
import { updateCounter } from "./update_counter.js";

// Импортируем типы
import type { MediaViewer } from "../index.js";

/**
 * ***************************************************************************
 * Показ медиафайла по индексу: сброс вида, пересборка трёх слотов
 * (prev / active / next) и обновление счётчика.
 *
 * Ошибки пробрасываются наружу: их ловит `_onBeforeOpen` формы.
 * @param form - Экземпляр формы.
 * @param index - Индекс медиафайла (нормализуется с учётом loop).
 * @returns Применение слотов.
 * ***************************************************************************
 */
export async function showMedia(form: MediaViewer, index: number): Promise<void> {

    resetView(form, false);

    // Нормализация индекса: выходим за границы — зацикливаемся или упираемся
    if (index < 0) form.currentIndex = form.options.loop ? form.media.length - 1 : 0;
    else if (index >= form.media.length) form.currentIndex = form.options.loop ? 0 : form.media.length - 1;
    else form.currentIndex = index;

    // Соседние индексы (null - конец списка без зацикливания)
    const prevIndex = form.currentIndex - 1 < 0 ? (form.options.loop ? form.media.length - 1 : null) : form.currentIndex - 1;
    const nextIndex = form.currentIndex + 1 >= form.media.length ? (form.options.loop ? 0 : null) : form.currentIndex + 1;

    if (form.elements.loader) form.elements.loader.style.display = "block";

    destroyPlayer(form);

    const slotPrev = form.tpl?.querySelector('[data-slot="prev"]') ?? null;
    const slotActive = form.tpl?.querySelector('[data-slot="active"]') ?? null;
    const slotNext = form.tpl?.querySelector('[data-slot="next"]') ?? null;

    await Promise.all([
        renderSlot(form, slotPrev, prevIndex, false),
        renderSlot(form, slotActive, form.currentIndex, true),
        renderSlot(form, slotNext, nextIndex, false)
    ]);

    if (form.elements.loader) form.elements.loader.style.display = "none";
    updateCounter(form);

}
