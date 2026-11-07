// Импортируем utils
import { Logger } from "../../../../../utils/logs/logger.js";

// Импортируем forms
import { Messages } from "../../../../messages/index.js";

// Импортируем db
import { messagesTable } from "../../../db.js";

/**
 * ***************************************************************************
 * applyCommentsCountDelta - инкремент/декремент счётчика комментариев поста.
 *
 * Счётчик живёт в сообщении (`Message.count_comments`) и обновляется только
 * из пушей `[comment]: new` / `[comment]: remove` (сервер событий счётчика
 * не шлёт — см. docs-api/websocket/server-to-client/comments.md). Обновляются
 * оба хранилища поста:
 * - стор открытого чата: строка поста перерисуется через item::updated;
 * - IndexedDB: закэшированный пост не должен отстать от сервера (иначе
 *   после перезагрузки счётчик вернётся к старому значению).
 * @param entityId - Id поста (сообщения).
 * @param channelId - Id канала поста (без него стор чата не найти).
 * @param delta - Приращение счётчика (+1 — новый, -1 — удалённый).
 * @returns Promise<void>
 * ***************************************************************************
 */
export async function applyCommentsCountDelta(entityId: string, channelId: string | undefined, delta: number): Promise<void> {

    // ---------- Стор открытого чата ----------

    // invariant: реестр форм сообщений ключуется id канала
    const messagesForm = channelId ? Messages.instances.get(channelId) : undefined;
    const post = messagesForm?.store.get(entityId);

    if (messagesForm && post) {

        // Счётчик не может уйти в минус (например, при гонке удалений)
        const next = Math.max(0, (post.count_comments ?? 0) + delta);
        messagesForm.store.update(entityId, { count_comments: next });

    }

    // ---------- IndexedDB ----------

    try {

        // Получаем закэшированный пост (может отсутствовать — канал не открыт)
        const stored = await messagesTable().get(entityId);
        if (stored) {

            const next = Math.max(0, (stored.count_comments ?? 0) + delta);
            await messagesTable().put({ ...stored, count_comments: next });

        }

    } catch (error) {

        // Фоновое обновление кэша: ошибка БД не должна ронять обработку пуша
        Logger.warn("[app][ws][comments]: не удалось обновить count_comments в IndexedDB.", error);

    }

}
