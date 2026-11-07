// Импортируем типы
import type { ChannelSectionItemData } from "../types.js";

/**
 * Тип строки секции: как запись связана с сообщением-владельцем.
 *
 * У вложений (фото/видео/файлы/аудио/голосовые) строка — это документ, и
 * ссылка на сообщение, из которого его отправили, лежит в entity_context.
 * У «Ссылок» строка — само сообщение, его id хранится в поле id записи.
 */
export type SectionRowKind = "attachment" | "message";

/**
 * ***************************************************************************
 * getSectionMessageId - id сообщения, которому принадлежит запись секции.
 *
 * Нужен пункту «Перейти к сообщению» контекстного меню: вложение живёт
 * внутри поста, и сервер помечает это в entity_context
 * ({ type: "message", id }). Вложений без сообщения там не будет — для них
 * перехода нет.
 * @param data - Запись секции.
 * @param kind - Тип строки: "attachment" — вложение (id из entity_context),
 *   "message" — строка-сообщение «Ссылок» (id самой записи).
 * @returns Id сообщения либо null, если записи сообщение не принадлежит.
 * ***************************************************************************
 */
export function getSectionMessageId(
    data: ChannelSectionItemData | undefined,
    kind: SectionRowKind
): string | null {

    // Записи без данных не бывает, но защита дешевле падения в вызывающем коде
    if (!data) return null;

    // Строка-сообщение («Ссылки»): id сообщения — это id самой записи
    if (kind === "message") {
        return data.id !== undefined ? String(data.id) : null;
    }

    // Вложение: ссылка на сообщение-владельца лежит в entity_context
    const context = data.entity_context;
    if (context?.type !== "message" || !context.id) return null;

    return context.id;

}
