// Импортируем utils
import { IndexedDB } from "../../../../utils/indexed_db.js";
import { cleanStoreData } from "../../../../utils/helpers/clean_store_data.js";
import { toastError } from "../../../../utils/ui/toast_error.js";

// Загружаем requests
import { messageSendReactionRequest } from "../requests/message_send_reaction.js";

// Импортируем components
import { messageReactions } from "../message_reactions.js";

// Импортируем типы
import type { MessageReaction } from "../types.js";
import type { MessageRecord } from "../../types.js";
import type { MessageItem } from "../message.js";

/**
 * ***************************************************************************
 * sendReactionHandler - отправка реакции.
 *
 * Отправляет реакцию и сразу применяет ответ сервера: сервер возвращает
 * полный список реакций сообщения, поэтому пользователь видит свою реакцию
 * мгновенно, не дожидаясь следующего такта поллинга (4 секунды).
 * @param message - Родительское сообщение.
 * @param reaction - Emoji реакция.
 * ***************************************************************************
 */
export async function sendReactionHandler(message: MessageItem, reaction: string): Promise<void> {

    // Без сообщения или без id отправлять нечего
    if (!message?.data?.id) return;

    try {

        // Запрос
        let response = await messageSendReactionRequest({
            message_id: message.data.id,
            reaction: reaction
        });

        // Получаем реакции из ответа сервера
        let reactions: MessageReaction[] = response?.data || [];
        message.data.reactions = reactions;

        // Вызываем обновление реакций
        messageReactions(message);

        // Синхронизируем IndexedDB: иначе после перезагрузки приложения
        // реакция пропадала до следующего опроса с сервера
        await syncToDB(message.data.id, reactions);

    } catch (error) {

        // Ошибку показываем тостом: иначе клик по реакции выглядел бы
        // как «ничего не произошло»
        toastError(error, { context: "[app][messages][send-reaction]" });

    }

}

/**
 * ***************************************************************************
 * Записать реакции сообщения в IndexedDB.
 * @param messageId - ID сообщения.
 * @param reactions - Актуальные реакции.
 * @returns Promise<void>
 * ***************************************************************************
 */
async function syncToDB(messageId: string, reactions: MessageReaction[]): Promise<void> {

    const entity = await IndexedDB.db?.table<MessageRecord, string>("messages").get(messageId);

    // Сообщения нет в локальной базе (например, ещё не доехало до IDB) — не страшно
    if (!entity) return;

    entity.reactions = reactions;
    // invariant: cleanStoreData возвращает копию записи сообщения без служебных ключей
    await IndexedDB.db?.table<MessageRecord, string>("messages").put(cleanStoreData(entity) as MessageRecord);

}
