// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { ForwardChannelRecord } from "../types.js";

/**
 * ***************************************************************************
 * Сортировка каналов по времени последнего сообщения (свежие сверху).
 *
 * Каналы без последнего сообщения уходят вниз, сохраняя исходный порядок;
 * не-массив на границе с IndexedDB отбрасывается с ошибкой в лог.
 * @param channels - Массив каналов для сортировки.
 * @returns Новый отсортированный массив.
 * ***************************************************************************
 */
export function sortChannels(channels: ForwardChannelRecord[]): ForwardChannelRecord[] {

    try {

        if (!Array.isArray(channels)) {
            Logger.error("channels должен быть массивом", { channels });
            return channels || [];
        }

        // Создаем копию массива для сортировки
        const sortedChannels = [...channels];

        // Сортируем массив
        sortedChannels.sort((a, b) => {
            const aTime = a.last_message?.created_at;
            const bTime = b.last_message?.created_at;

            // Оба имеют last_message
            if (aTime && bTime) {
                return new Date(bTime).getTime() - new Date(aTime).getTime();
            }

            // Только a имеет last_message
            if (aTime && !bTime) {
                return -1; // a идет выше b
            }

            // Только b имеет last_message
            if (!aTime && bTime) {
                return 1; // b идет выше a
            }

            // Оба не имеют last_message - сохраняем исходный порядок
            return 0;
        });

        return sortedChannels;

    } catch (error) {
        Logger.error("Ошибка при сортировке каналов", { error, channels });
        return channels || [];
    }

}
