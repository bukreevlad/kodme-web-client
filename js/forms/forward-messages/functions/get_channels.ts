// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { LocalStorage } from "../../../utils/local_storage.js";

// Импортируем functions
import { sortChannels } from "./sort_channels.js";

// Импортируем forms
import { channelsTable } from "../../main/db.js";

// Импортируем типы
import type { SessionProfile } from "../../menu/types.js";
import type { ForwardChannelAddOptions, ForwardChannelRecord } from "../types.js";
import type { ForwardMessages } from "../index.js";

/**
 * ***************************************************************************
 * Загрузка списка каналов для пересылки из IndexedDB главной формы.
 *
 * Предфильтр «куда разрешено пересылать» повторяет серверную проверку
 * прав публикации: личные диалоги, избранное и боты — всегда; создатель
 * сущности — всегда; иначе — когда в сущности разрешён постинг и она
 * публичная либо пользователь в ней подписан.
 *
 * @param form - Экземпляр формы.
 * @returns Promise без значения.
 * ***************************************************************************
 */
export async function getChannels(form: ForwardMessages): Promise<void> {

    try {

        // Текущая сессия: поле user хранится как unknown (граница
        // localStorage), приводим к профилю сессии — invariant: сессия
        // всегда пишется целиком с полем user (см. SessionProfile)
        const session = LocalStorage.session;

        // Получаем каналы из IndexedDB (канонический доступ — таблица
        // из формы main, а не плоский Dexie.db)
        const channels = await channelsTable().toArray() as ForwardChannelRecord[];

        // Проходим по каналам
        if (channels.length > 0) {

            // invariant: блок выполняется только при непустом списке,
            // а сессия под активным пользователем обязательна — иначе
            // чтение id упадёт в catch ниже и форма останется пустой
            const sessionUser = session?.user as SessionProfile;

            // Сортируем каналы по времени последнего сообщения
            const sortedChannels = sortChannels(channels);

            // Проходим по каналам
            for (const channel of sortedChannels) {

                // Имеет ли право пересылать сюда сообщение
                const canForwardInChat =
                    [1, 5, 8].includes(channel.type ?? -1) ||
                    channel.created_user_id === sessionUser.id ||
                    (channel.is_posting && (channel.is_public || channel.is_subscribed));

                // Добавляем В Store
                if (canForwardInChat) {

                    // Проверяем канал
                    const isStore = form.store.get(channel.id);
                    if (isStore) {
                        form.store.update(channel.id, channel);
                    } else {

                        // Направление вставки — переменной (стор принимает
                        // StoreAddOptions без direction, литерал упёрся бы
                        // в проверку свежих объектов)
                        const options: ForwardChannelAddOptions = { direction: "next" };
                        form.store.add(channel, options);
                    }

                }

            }

        }

    } catch (error) {
        Logger.error(error);
    }

}
