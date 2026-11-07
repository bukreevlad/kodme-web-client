// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { CacheManager } from "../../../utils/cache_manager.js";
import { forStorage } from "../../../utils/network/storage_url.js";

// Импортируем handlers
import { contextMenuHandler } from "./handlers/context_menu.js";
import { openStickerPakHandler } from "./handlers/open_sticker_pak.js";

// Импортируем типы
import type { MessageItem } from "./message.js";

/**
 * ***************************************************************************
 * Создание элемента стикера для блока вложений sticker-сообщения.
 *
 * Стикер-сообщение приходит без массива attachments: документ лежит в поле
 * `sticker_document_id`, а токен на чтение файла — в поле `sticker`.
 * Тап по стикеру открывает его набор (см. handlers/open_sticker_pak.ts).
 * @param message - Родительский компонент сообщения.
 * @returns DOM-элемент стикера либо null (не sticker-сообщение).
 * ***************************************************************************
 */
export function createStickerItem(message: MessageItem): HTMLImageElement | null {

    try {

        // Не sticker-сообщение — блок не строится
        if (!message.data?.sticker_document_id) return null;

        // Создаем элемент из шаблона
        const element = createTemplate();

        // Без шаблона элемент не создаётся
        if (!element) return null;

        // Формируем ссылку через CacheManager (токен кладётся в query, дальше
        // ресурс перехватывает Service Worker — медиа-кеш); без токена
        // ссылка строится напрямую
        element.src = message.data.sticker
            ? CacheManager.getMediaSrc({
                url: forStorage(message.data.sticker_document_id),
                file_token: message.data.sticker,
                type: "media"
            })
            : forStorage(message.data.sticker_document_id);

        // Тап по стикеру открывает его набор
        element.addEventListener("click", (event) => {

            // Тап по стикеру не должен дёргать контекстное меню/жесты строки
            event.stopPropagation();

            // Открываем набор стикера
            openStickerPakHandler(message);

        });

        // Долгое нажатие/ПКМ по стикеру — контекстное меню сообщения: на
        // мобильных тап занят набором, меню остаётся по удержанию
        element.addEventListener("contextmenu", (event) => {

            event.preventDefault();
            event.stopPropagation();
            contextMenuHandler(event, message);

        });

        return element;

    } catch (error) {
        Logger.error("[app][messages][attaches-sticker]:", error);
        return null;
    }

}

/**
 * ***************************************************************************
 * Шаблон стикера: DOMParser для безопасного создания DOM без innerHTML.
 * Стикер — самостоятельная картинка сообщения, без рамок и фона.
 * @returns DOM-элемент изображения стикера.
 * ***************************************************************************
 */
function createTemplate(): HTMLImageElement | null {

    const element = new DOMParser().parseFromString(`
        <img class="sticker max-w-[200px] max-h-[200px] object-contain" alt="" draggable="false">
    `, "text/html").querySelector<HTMLImageElement>(".sticker");

    // Своя разметка всегда содержит «.sticker» — без элемента стикер не создаётся
    if (!element) throw new Error("Не найден шаблон: .sticker");

    return element;

}
