// Импортируем utils
import { toastError } from "../../../utils/ui/toast_error.js";

// Импортируем functions
import { openStickerPak } from "./open_sticker_pak.js";

// Импортируем типы
import type { EmojiFocusSticker } from "../types.js";
import type { StickerPakData } from "../../sticker-pak/types.js";
import type { Emoji } from "../index.js";

/**
 * ***************************************************************************
 * Перейти к стикеру в панели «Стикеры»: активный таб, сетка его пака,
 * прокрутка к элементу и моргание (как подсветка сообщений при переходе).
 * @param form - Форма эмодзи.
 * @param focus - Стикер, к которому переходим.
 * @param data - Уже загруженный пак (без него запрашивается в openStickerPak).
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function showSticker(form: Emoji, focus: EmojiFocusSticker, data?: StickerPakData | null | undefined): Promise<void> {

    try {

        // Панель без таба стикеров — перейти к стикеру нельзя
        if (!form.showStickers) return;

        // Активируем таб «Стикеры» (список паков грузится его активацией)
        form.tabs?.activateTab("stickers");

        // Сразу стадия 2 — сетка стикеров пака
        await openStickerPak(form, { id: focus.pakId }, data);

        // Ищем элемент стикера в сетке по его документу
        const item = form.stickersGrid?.querySelector<HTMLElement>(`[data-document-id="${focus.documentId}"]`);
        if (!item) return;

        // Прокручиваем сетку к стикеру
        item.scrollIntoView({ block: "center", inline: "nearest" });

        // Моргание: сброс класса → reflow → повторное добавление (перезапуск анимации)
        item.classList.remove("backlight");
        void item.offsetWidth;
        item.classList.add("backlight");

    } catch (error) {

        // Показываем тост (коды ошибок разбирает сам toastError)
        toastError(error, {
            context: "[app][emoji][show-sticker]",
            fallback: window._lc.forms.emoji.stickers.pak_load_error
        });

    }

}
