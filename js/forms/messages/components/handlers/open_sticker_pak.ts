// Импортируем utils
import { toastError } from "../../../../utils/ui/toast_error.js";

// Импортируем components
import { Toast } from "../../../../components/toast.js";

// Импортируем forms
import { StickerPak } from "../../../sticker-pak/index.js";

// Импортируем requests
import { getStickerPakRequest } from "../../../emoji/requests/get_sticker_pak.js";

// Импортируем handlers
import { emojiHandler } from "../../handlers/emoji.js";

// Импортируем типы
import type { MessageItem } from "../message.js";

/**
 * ***************************************************************************
 * openStickerPakHandler - клик по стикеру сообщения: открыть его набор.
 *
 * Набор у пользователя (свой либо добавленный) — панель «Стикеры» с переходом
 * к стикеру; не добавлен — форма набора с кнопкой «Добавить к себе».
 * @param message - Родительский компонент сообщения.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function openStickerPakHandler(message: MessageItem): Promise<void> {

    try {

        // Стикер без известного набора — открыть нечего
        const pakId = message.data.sticker_pak_id;
        const documentId = message.data.sticker_document_id;
        if (!pakId || !documentId) {
            Toast.error(window._lc.forms.messages.toasts.sticker_pak_unavailable);
            return;
        }

        // Набор со стикерами: его флаги решают, какую форму открыть
        // (ошибки сервера сокет пробрасывает reject'ом)
        const response = await getStickerPakRequest({ pak_id: pakId });
        const pak = response?.data;
        if (!pak) return;

        if (pak.is_author || pak.is_member) {

            // Набор у пользователя — панель стикеров с переходом к нему
            emojiHandler(message.form, { pakId, documentId });

        } else {

            // Набор не добавлен — форма набора (кнопка «Добавить к себе»)
            new StickerPak({ pakId });

        }

    } catch (error) {

        // Показываем тост (набор удалён/недоступен и любые ошибки сервера)
        toastError(error, {
            context: "[app][messages][open-sticker-pak]",
            fallback: window._lc.forms.messages.toasts.sticker_pak_unavailable
        });

    }

}
