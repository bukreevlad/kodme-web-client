// Импортируем сторонние пакеты
import { v7 as Uuidv7 } from "uuid";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { toastError } from "../../../utils/ui/toast_error.js";
import { CacheManager } from "../../../utils/cache_manager.js";
import { forStorage } from "../../../utils/network/storage_url.js";
import { buildLocalMediaMetadata } from "../../../utils/media/local_media_metadata.js";
import { SecretChatsManager } from "../../../core/managers/secret_chats_manager.js";

// Импортируем functions
import { blobToDataUri } from "./build_attaches.js";
import { registerLocalOriginals } from "./file_progress.js";
import { queueFiles } from "./sending_messages.js";

// Импортируем типы
import type { SecretFileRef } from "../../../utils/secret_chats/secret_frames.js";
import type { StickerItem } from "../../sticker-pak/types.js";
import type { SecretChat } from "../index.js";

/**
 * ***************************************************************************
 * Отправка стикера в секретный чат.
 *
 * Байты стикера (webp/png из пака) скачиваются локально и уходят файлом
 * (как обычное вложение): получатель хранит blob локально и от серверных
 * паков не зависит. Метаданные и миниатюра (сам стикер — он маленький)
 * уходят в payload — сообщение отображается сразу.
 * @param form - Экземпляр формы секретного чата.
 * @param sticker - Выбранный стикер (id документа и токен чтения).
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function sendSticker(form: SecretChat, sticker: StickerItem): Promise<void> {

    try {

        // Менеджер обязан быть инициализирован (создаётся вместе с home)
        const manager = SecretChatsManager.instance;
        if (!manager) return;

        // Скачиваем blob стикера по его ссылке (токен кладётся в query,
        // дальше ресурс перехватывает Service Worker — медиа-кеш)
        const url = CacheManager.getMediaSrc({
            url: forStorage(sticker.document_id),
            file_token: sticker.file_token ?? "",
            type: "media"
        });
        const response = await fetch(url);
        if (!response.ok) throw new Error("Не удалось получить стикер");
        const blob = await response.blob();

        // Локальный файл стикера (нужен для метадаты: размеры/превью)
        const extension = blob.type.split("/")[1] || "webp";
        const file = new File([blob], `sticker.${extension}`, { type: blob.type });
        const metadata = await buildLocalMediaMetadata(file);

        // Метаданные в payload: миниатюра — сам стикер (data-URI)
        const fileId = Uuidv7();
        const ref: SecretFileRef = {
            file_id: fileId,
            name: file.name,
            mime_type: blob.type,
            size: blob.size,
            duration: null,
            width: metadata?.original?.width ?? null,
            height: metadata?.original?.height ?? null,
            thumbnail: await blobToDataUri(blob),
            thumbnail_width: metadata?.original?.width ?? null,
            placeholder: metadata?.placeholder ?? null,
            wave_form: null,
            flags: null
        };

        // Локальный оригинал стикера доступен сразу, без ожидания передачи
        registerLocalOriginals([{ fileId, blob }]);

        // Сообщение-стикер (метаданные уходят в payload сразу)
        const messageId = await manager.sendMessage(form.chatId, "sticker", {
            text: null,
            reply_to: null,
            duration: null,
            files: [ref]
        });

        // Оригинал уходит файлом с прогрессом (как обычные вложения)
        queueFiles(form, {
            messageId,
            files: [{
                fileId,
                blob,
                meta: {
                    name: file.name,
                    mime_type: blob.type,
                    duration: null,
                    width: ref.width,
                    height: ref.height
                }
            }]
        });

        // Прокручиваем в самый низ (без менеджера скролла — просто не прокручиваем)
        form.listScrollManager?.scrollToBottom("smooth");

    } catch (error) {

        // Показываем тост (коды ошибок разбирает сам toastError)
        toastError(error, {
            context: "[app][secret-chat][send-sticker]",
            fallback: window._lc.forms.secret_chat.toasts.sticker_send_error
        });

        // Лог для отладки
        Logger.error("[app][secret-chat][send-sticker]:", error);

    }

}
