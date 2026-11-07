// Импортируем config
import { Socket } from "../../../../../config/socket.js";

// Импортируем utils
import { Logger } from "../../../../../utils/logs/logger.js";

// Импортируем forms
import { Main } from "../../../index.js";

// Импортируем типы
import { isRecord } from "../../../types.js";

/**
 * Нагрузка ws-события обновления онлайн-статуса пользователя.
 */
interface OnlineStatusPayload {

    /** Id пользователя. */
    user_id: string;

    /** Статус присутствия ("online" — в сети, иначе — не в сети). */
    status: string;

}

/**
 * Значение — нагрузка статуса пользователя.
 * @param value - Проверяемое значение.
 * @returns true, если значение похоже на нагрузку.
 */
function isOnlineStatusPayload(value: unknown): value is OnlineStatusPayload {
    return isRecord(value) && typeof value.user_id === "string" && typeof value.status === "string";
}

/**
 * ***************************************************************************
 * Подписка на онлайн-статус собеседника: у диалогов перерисовывается
 * точка статуса на аватаре.
 * ***************************************************************************
 */
export function subscribeOnlineStatus(): void {

    // ***************************************************************************
    // Обновление онлайн статуса пользователя
    // ***************************************************************************
    Socket.client.on("[user]: online status", (data) => {
        Logger.debug("[app][ws]::[user]: online status", data);

        try {

            // Нагрузка сокета типизирована как unknown: работаем только с известной структурой
            if (!isOnlineStatusPayload(data)) return;

            // Получаем каналы из Main.Store
            const channels = Main.instance?.store.getAll();

            // Проходим по каналам
            channels?.forEach(channel => {

                // Если это диалог
                if (channel.type === 1 && channel.display_user_id === data.user_id) {
                    channel.display_user_is_online = data.status === "online" ? true : false;
                    Main.instance?.store.update(channel.id, channel);
                }

            });

        } catch (error) {
            Logger.error(error);
        }

    });

}
