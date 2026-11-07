// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем handlers
import { contextMenuHandler } from "./handlers/context_menu.js";

// Импортируем типы
import { normalizeAttachments } from "./types.js";
import type { SecretChatMessageItem } from "./message.js";

/**
 * ***************************************************************************
 * Создание элемента стикера для блока вложений sticker-сообщения секретного
 * чата.
 *
 * Стикер приходит зашифрованным blob'ом изображения (webp/png из пака):
 * до прихода файла показывается миниатюра из метаданных, после — оригинал.
 * Копия forms/messages/components/attaches_sticker.ts под секретные чаты
 * (без серверных ссылок и открытия пака).
 * @param message - Родительский компонент сообщения.
 * @returns DOM-элемент стикера либо null (не sticker-сообщение).
 * ***************************************************************************
 */
export function createStickerItem(message: SecretChatMessageItem): HTMLImageElement | null {

    try {

        // Не sticker-сообщение — блок не строится
        if (message.data?.type !== "sticker") return null;

        // Берём единственное вложение стикера (объект-мап по file_id)
        const attachments = message.data.attachments
            ? normalizeAttachments(message.data.attachments)
            : [];
        const attach = attachments[0];
        if (!attach) return null;

        // Создаем элемент из шаблона
        const element = createTemplate();
        if (!element) return null;

        // Источник — расшифрованный blob оригинала; пока файл не принят,
        // показываем миниатюру из метаданных (data-URI из payload)
        if (attach._file instanceof File || attach._file instanceof Blob) {
            element.src = URL.createObjectURL(attach._file);
        } else {
            const thumbnail = attach.metadata?.thumbnails?.[0];
            const thumbnailUrl = thumbnail && typeof thumbnail._url === "string" ? thumbnail._url : null;
            if (thumbnailUrl) {
                element.src = thumbnailUrl;
            } else if (typeof attach.metadata?.placeholder === "string") {
                element.src = attach.metadata.placeholder;
            }
        }

        // Долгое нажатие/ПКМ по стикеру — контекстное меню сообщения:
        // тап занят отображением, меню остаётся по удержанию
        element.addEventListener("contextmenu", (event) => {

            event.preventDefault();
            event.stopPropagation();
            contextMenuHandler(event, message);

        });

        return element;

    } catch (error) {
        Logger.error("[app][secret-chat][attaches-sticker]:", error);
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
