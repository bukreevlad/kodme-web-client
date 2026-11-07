// Импортируем типы
import type { ChannelRecord } from "../types.js";

/**
 * ***************************************************************************
 * Сортировка каналов по времени последнего сообщения.
 *
 * Каналы без превью (без last_message) уходят в конец списка, а каналы
 * с одинаковым временем сохраняют исходный порядок.
 * @param channels - Массив каналов для сортировки.
 * @returns Новый массив каналов: свежие сверху.
 * ***************************************************************************
 */
export function sortChannels(channels: ChannelRecord[]): ChannelRecord[] {

    // Копия: сортировка не должна менять порядок исходного массива
    const sortedChannels = [...channels];

    // Сортируем по времени создания последнего сообщения (новее — выше)
    sortedChannels.sort((a, b) => {
        const aTime = a.last_secret_message?.created_at ?? a.last_message?.created_at;
        const bTime = b.last_secret_message?.created_at ?? b.last_message?.created_at;

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

}
