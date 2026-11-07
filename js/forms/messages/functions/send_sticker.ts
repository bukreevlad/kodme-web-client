// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { toastError } from "../../../utils/ui/toast_error.js";

// Импортируем requests
import { sendStickerRequest } from "../requests/send_sticker.js";

// Импортируем типы
import type { StickerItem } from "../../sticker-pak/types.js";
import type { Messages } from "../index.js";

/**
 * ***************************************************************************
 * Отправка стикера сообщением в открытый чат.
 *
 * Локального эха не создаётся: сервер разошлёт `[message]: new` всем
 * подписчикам канала, включая отправителя — лента дорисует сообщение
 * штатным событием (см. forms/main/events/socket/messages/new.ts).
 * @param form - Экземпляр формы сообщений.
 * @param sticker - Выбранный стикер (нужен id его документа).
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function sendSticker(form: Messages, sticker: StickerItem): Promise<void> {

    try {

        // Запрос отправки (ошибки сервера сокет пробрасывает reject'ом)
        await sendStickerRequest({
            channel_id: form.channelId,
            sticker_document_id: sticker.document_id
        });

    } catch (error) {

        // Показываем тост (коды ошибок разбирает сам toastError)
        toastError(error, {
            context: "[app][messages][send-sticker]",
            fallback: window._lc.forms.messages.toasts.sticker_send_error
        });

        // Лог для отладки (стикер ушёл, но сервер отверг)
        Logger.error("[app][messages][send-sticker]:", error);

    }

}
