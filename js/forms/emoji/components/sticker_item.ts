// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { CacheManager } from "../../../utils/cache_manager.js";
import { forStorage } from "../../../utils/network/storage_url.js";

// Импортируем типы
import type { StickerItem } from "../../sticker-pak/types.js";
import type { Emoji } from "../index.js";

/**
 * ***************************************************************************
 * Создание DOM-элемента стикера в сетке пака (стадия 2 панели).
 *
 * Тап отдаёт стикер обработчику выбора вызывающей формы (обычно — отправка
 * стикер-сообщением) и закрывает панель (поведение по умолчанию).
 * @param form - Форма эмодзи.
 * @param sticker - Данные стикера (id, документ, токен).
 * @returns DOM-элемент стикера либо null (без шаблона/документа).
 * ***************************************************************************
 */
export function createEmojiStickerItem(form: Emoji, sticker: StickerItem): HTMLElement | null {

    try {

        // Создаем DOM-элемент из шаблона
        const element = createTemplate();

        // Без шаблона элемент не создаётся
        if (!element) return null;

        // Без документа хранилище файл не найдёт — элемент бессмыслен
        if (!sticker.document_id) return null;

        // Документ стикера — ключ поиска элемента (переход к стикеру, см. functions/show_sticker.ts)
        element.setAttribute("data-document-id", sticker.document_id);

        // Формируем ссылку через CacheManager (токен кладётся в query, дальше
        // ресурс перехватывает Service Worker — медиа-кеш)
        const image = element.querySelector("img");
        if (image) {
            image.src = CacheManager.getMediaSrc({
                url: forStorage(sticker.document_id),
                file_token: sticker.file_token ?? undefined,
                type: "media"
            });
        }

        // Тап: отдаём стикер вызывающей форме и закрываем панель
        element.addEventListener("click", () => {
            form.stickerCallback?.(sticker);
            form.modal?.close();
        });

        return element;

    } catch (error) {
        Logger.error("[app][emoji][sticker-item]:", error);
        return null;
    }

}

/**
 * ***************************************************************************
 * Шаблон стикера: DOMParser для безопасного создания DOM без innerHTML.
 * @returns DOM-элемент стикера.
 * ***************************************************************************
 */
function createTemplate(): HTMLElement | null {

    const element = new DOMParser().parseFromString(`
        <div class="sticker-item flex items-center justify-center p-1.5 aspect-square rounded-lg hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)] cursor-pointer">
            <img class="max-w-full max-h-full object-contain" alt="" draggable="false">
        </div>
    `, "text/html").querySelector<HTMLElement>(".sticker-item");

    // Своя разметка всегда содержит «.sticker-item» — без элемента стикер не создаётся
    if (!element) throw new Error("Не найден шаблон: .sticker-item");

    return element;

}
