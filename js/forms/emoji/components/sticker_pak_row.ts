// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { CacheManager } from "../../../utils/cache_manager.js";
import { forStorage } from "../../../utils/network/storage_url.js";

// Импортируем functions
import { openStickerPak } from "../functions/open_sticker_pak.js";

// Импортируем типы
import type { StickerPakItem } from "../../sticker-paks/types.js";
import type { Emoji } from "../index.js";

/**
 * ***************************************************************************
 * Создание DOM-элемента пака в списке панели «Стикеры» (стадия 1).
 *
 * По ТЗ в строке — небольшое превью первого стикера пака и название;
 * тап открывает стикеры пака (стадия 2).
 * @param form - Форма эмодзи.
 * @param pak - Данные пака.
 * @returns DOM-элемент строки пака либо null (без шаблона/названия).
 * ***************************************************************************
 */
export function createStickerPakRow(form: Emoji, pak: StickerPakItem): HTMLElement | null {

    try {

        // Создаем DOM-элемент из шаблона
        const element = createTemplate();

        // Без шаблона элемент не создаётся
        if (!element) return null;

        // Превью: первый стикер пака (маленький — ряд выглядит аккуратно)
        const first = pak.preview?.[0];
        const preview = element.querySelector<HTMLImageElement>("[data-preview]");
        if (preview && first?.document_id) {

            // Ссылка через CacheManager: токен в query, дальше ресурс
            // перехватывает Service Worker (медиа-кеш)
            preview.src = CacheManager.getMediaSrc({
                url: forStorage(first.document_id),
                file_token: first.file_token ?? undefined,
                type: "media"
            });
            preview.classList.remove("hidden");

        }

        // Название пака
        const name = element.querySelector("[data-name]");
        if (name) name.textContent = pak.name;

        // Тап: открываем стикеры пака (стадия 2 панели)
        element.addEventListener("click", () => openStickerPak(form, pak));

        return element;

    } catch (error) {
        Logger.error("[app][emoji][sticker-pak-row]:", error);
        return null;
    }

}

/**
 * ***************************************************************************
 * Шаблон строки пака: DOMParser для безопасного создания DOM без innerHTML.
 * @returns DOM-элемент строки пака.
 * ***************************************************************************
 */
function createTemplate(): HTMLElement | null {

    const element = new DOMParser().parseFromString(`
        <div class="item flex flex-row gap-2 p-2 rounded-lg hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)] cursor-pointer">
            <img data-preview class="w-8 h-8 shrink-0 rounded object-contain hidden" alt="" draggable="false">
            <span data-name class="flex flex-row gap-2 items-center truncate"></span>
        </div>
    `, "text/html").querySelector<HTMLElement>(".item");

    // Своя разметка всегда содержит «.item» — без элемента строка не создаётся
    if (!element) throw new Error("Не найден шаблон: .item");

    return element;

}
