// Импортируем functions
import { updateEmptyState } from "./update_empty_state.js";
import { syncListPak } from "./sync_list_pak.js";

// Импортируем типы
import type { StickerPak } from "../index.js";

/**
 * ***************************************************************************
 * Удаление стикера из сетки пака после успешного запроса.
 *
 * Плашка пака в списке обновляется синхронно: количество стикеров −1,
 * из превью убирается удалённый стикер (если входил в него).
 *
 * @param form - Экземпляр формы.
 * @param stickerId - Id удаляемого стикера.
 * ***************************************************************************
 */
export function removeSticker(form: StickerPak, stickerId: string): void {

    // Убираем стикер из данных формы
    const index = form.stickers.findIndex((sticker) => sticker.sticker_id === stickerId);
    if (index >= 0) form.stickers.splice(index, 1);

    // Убираем элемент из сетки (id — UUID, безопасен в селекторе)
    form.list?.querySelector(`[data-sticker-id="${stickerId}"]`)?.remove();

    // Показываем/прячем пустое состояние
    updateEmptyState(form);

    // Обновляем плашку пака в списке: количество + превью
    syncListPak(form, (item) => ({
        ...item,
        stickers_count: Math.max(0, item.stickers_count - 1),
        preview: item.preview.filter((preview) => preview.sticker_id !== stickerId)
    }));

}
