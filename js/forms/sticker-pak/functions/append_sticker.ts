// Импортируем components
import { createStickerItem } from "../components/sticker_item.js";

// Импортируем functions
import { updateEmptyState } from "./update_empty_state.js";
import { syncListPak } from "./sync_list_pak.js";

// Импортируем типы
import type { StickerItem } from "../types.js";
import type { StickerPak } from "../index.js";

/**
 * Количество стикеров в превью пака (сетка 2×2 в списке).
 */
const PREVIEW_LIMIT = 4;

/**
 * ***************************************************************************
 * Вставка нового стикера в сетку пака после успешной загрузки.
 *
 * Плашка пака в списке обновляется синхронно: количество стикеров +1,
 * а превью пополняется, пока в паке меньше PREVIEW_LIMIT стикеров.
 *
 * @param form - Экземпляр формы.
 * @param sticker - Сохранённый стикер (id, документ, токен).
 * ***************************************************************************
 */
export function appendSticker(form: StickerPak, sticker: StickerItem): void {

    // Добавляем стикер в данные формы
    form.stickers.push(sticker);

    // Добавляем элемент в конец сетки
    const element = createStickerItem(form, sticker);
    if (element) form.list?.appendChild(element);

    // Показываем/прячем пустое состояние
    updateEmptyState(form);

    // Обновляем плашку пака в списке: количество + превью
    syncListPak(form, (item) => ({
        ...item,
        stickers_count: item.stickers_count + 1,
        preview: item.stickers_count < PREVIEW_LIMIT
            ? [...item.preview, { sticker_id: sticker.sticker_id, document_id: sticker.document_id, file_token: sticker.file_token }]
            : item.preview
    }));

}
