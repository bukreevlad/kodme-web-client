// Импортируем utils
import { IndexedDB } from "../../../../utils/indexed_db.js";
import { cleanStoreData } from "../../../../utils/helpers/clean_store_data.js";
import { toastError } from "../../../../utils/ui/toast_error.js";

// Импортируем functions
import { getSessionUserId, getSessionUserDisplayName, getSessionUserAvatar } from "../../../main/functions/session_identity.js";

// Загружаем requests
import { messageSendReactionRequest } from "../requests/message_send_reaction.js";

// Импортируем components
import { messageReactions } from "../message_reactions.js";

// Импортируем типы
import type { MessageReaction } from "../types.js";
import type { MessageData } from "../types.js";
import type { MessageRecord } from "../../types.js";
import type { MessageItem } from "../message.js";

/**
 * ***************************************************************************
 * messageReactionClickHandler - переключение реакции сообщения.
 *
 * Переключает реакцию сообщения (оптимистично): сразу обновляет UI локально,
 * а результат сервера применяет как актуальный список.
 * @param message - Родительское сообщение.
 * @param reaction - Emoji реакция.
 * ***************************************************************************
 */
export async function messageReactionClickHandler(message: MessageItem, reaction: string): Promise<void> {

    // ID сообщения
    let messageId = message.data?.id;
    if (!messageId) return;

    // Сохраняем предыдущее состояние реакций (нужно для отката при ошибке)
    let previousReactions = message.data?.reactions;

    try {

        // Оптимистично применяем переключение реакции до ответа сервера
        applyOptimisticReaction(message.data, reaction);

        // Перерисовываем блок реакций
        messageReactions(message);

        // Запрос
        let response = await messageSendReactionRequest({
            message_id: messageId,
            reaction: reaction
        });

        // Получаем актуальный список реакций с сервера
        let reactions: MessageReaction[] = response.data || [];
        message.data.reactions = reactions;

        // Вызываем обновление реакций
        messageReactions(message);

        // Синхронизируем IndexedDB: после перезагрузки оптимистичное состояние
        // не восстановится, и реакция «откатилась» бы сама по себе
        await syncToDB(messageId, reactions);

    } catch (error) {

        // Показываем причину отказа тостом (например, превышение лимита запросов)
        toastError(error, { context: "[app][messages][reaction-click]" });

        // При ошибке откатываем оптимистичное изменение, чтобы UI не врал
        message.data.reactions = previousReactions;
        messageReactions(message);

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

    // Сообщения нет в локальной базе — не страшно, догонит опрос
    if (!entity) return;

    entity.reactions = reactions;
    // invariant: cleanStoreData возвращает копию записи сообщения без служебных ключей
    await IndexedDB.db?.table<MessageRecord, string>("messages").put(cleanStoreData(entity) as MessageRecord);

}

/**
 * ***************************************************************************
 * Применяет переключение реакции локально (без запроса на сервер):
 * ставит/снимает выбранную реакцию текущего пользователя и правит счётчики.
 * @param data - Данные сообщения (будет мутировано).
 * @param reaction - Emoji реакция.
 * ***************************************************************************
 */
function applyOptimisticReaction(data: MessageData, reaction: string): void {

    // Текущий пользователь (для состава avatars реакции)
    let userId = getSessionUserId();
    let displayName = getSessionUserDisplayName();
    let avatar = getSessionUserAvatar();

    // Нормализуем список реакций
    let reactions = Array.isArray(data.reactions) ? data.reactions : [];

    // Ищем реакцию с таким же emoji
    let target = reactions.find(r => r.reaction === reaction);

    // Если реакция с таким emoji уже есть — переключаем её
    if (target) {

        // Снимаем свою реакцию
        if (target.is_selected) {

            target.count = Math.max(0, (Number(target.count) || 1) - 1);
            target.is_selected = false;

            // Убираем пользователя из списка avatars
            if (Array.isArray(target.avatars)) {
                target.avatars = target.avatars.filter(a => a.user_id !== userId);
            }

            // Если реакций не осталось вовсе — убираем чип из списка
            if (Number(target.count) <= 0) {
                data.reactions = reactions.filter(r => r !== target);
            }

        } else {

            // Ставим свою реакцию поверх существующей
            target.count = (Number(target.count) || 0) + 1;
            target.is_selected = true;

            // Добавляем себя в avatars, если нас там ещё нет
            if (userId && Array.isArray(target.avatars) && !target.avatars.some(a => a.user_id === userId)) {
                target.avatars.push({
                    user_id: userId,
                    display_name: displayName || "",
                    avatar: avatar || null
                });
            }

        }

    } else {

        // Реакции с таким emoji ещё не было — создаём новую
        reactions.push({
            reaction: reaction,
            count: 1,
            is_selected: true,
            avatars: userId ? [{
                user_id: userId,
                display_name: displayName || "",
                avatar: avatar || null
            }] : []
        });
        data.reactions = reactions;

    }
}
