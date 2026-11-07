// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { toastError } from "../../../utils/ui/toast_error.js";

// Импортируем components
import { createEmojiStickerItem } from "../components/sticker_item.js";

// Импортируем requests
import { getStickerPakRequest } from "../requests/get_sticker_pak.js";

// Импортируем типы
import type { StickerPakItem } from "../../sticker-paks/types.js";
import type { StickerPakData } from "../../sticker-pak/types.js";
import type { Emoji } from "../index.js";

/**
 * ***************************************************************************
 * Открытие стикеров пака в панели «Стикеры» (стадия 2).
 *
 * Список паков прячется, поверх рисуется сетка стикеров с кнопкой «назад»
 * (возврат к списку — functions/back_to_paks.ts).
 * @param form - Форма эмодзи.
 * @param pak - Пак, стикеры которого открываем (нужен только id).
 * @param data - Уже загруженный пак со стикерами (без него — запрос к серверу).
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function openStickerPak(form: Emoji, pak: Pick<StickerPakItem, "id">, data?: StickerPakData | null | undefined): Promise<void> {

    try {

        // Данные пака: переданные вызывающим кодом либо запрос к серверу
        // (ошибки сервера сокет пробрасывает reject'ом)
        const pakData = data ?? (await getStickerPakRequest({ pak_id: pak.id }))?.data;

        // Неожиданный ответ — открывать нечего
        if (!pakData) return;

        // Очищаем сетку от стикеров прошлого пака
        if (form.stickersGrid) form.stickersGrid.innerHTML = "";

        // Название пака в шапке стадии
        if (form.pakName) form.pakName.textContent = pakData.name;

        // Рендерим сетку стикеров
        const stickers = Array.isArray(pakData.stickers) ? pakData.stickers : [];
        stickers.forEach((sticker) => {
            const element = createEmojiStickerItem(form, sticker);
            if (element) form.stickersGrid?.append(element);
        });

        // Плашка пустого пака: показываем только если стикеров нет
        form.stickersPakEmpty?.classList.toggle("hidden", stickers.length > 0);

        // Переключаем стадии: прячем список паков и пустое состояние
        form.paksList?.classList.add("hidden");
        form.stickersEmpty?.classList.add("hidden");
        form.stickersView?.classList.remove("hidden");

    } catch (error) {

        // Показываем тост (коды ошибок разбирает сам toastError)
        toastError(error, {
            context: "[app][emoji][open-sticker-pak]",
            fallback: window._lc.forms.emoji.stickers.pak_load_error
        });

    }

}
