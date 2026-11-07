// Импортируем config
import { MESSAGES_RENDER_ONLY_EMOJI } from "../../../../config/constants.js";

/**
 * ***************************************************************************
 * isValidEmojiOnly - проверка, что вся строка состоит только из 1-3 эмодзи.
 * Такие сообщения рендерятся увеличенным кеглем без пузыря текста.
 * @param text - Текст сообщения.
 * @returns true, если текст состоит только из эмодзи.
 * ***************************************************************************
 */
export function isValidEmojiOnly(text: string): boolean {
    return MESSAGES_RENDER_ONLY_EMOJI.test(text);
}
