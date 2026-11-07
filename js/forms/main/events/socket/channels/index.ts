// Импортируем events
import { subscribeChannelsNew } from "./new.js";
import { subscribeChannelsUpdate } from "./update.js";
import { subscribeChannelsRemove } from "./remove.js";

/**
 * ***************************************************************************
 * Подписки на события каналов (появление, обновление, удаление).
 * ***************************************************************************
 */
export function subscribeChannels(): void {

    subscribeChannelsNew();
    subscribeChannelsUpdate();
    subscribeChannelsRemove();

}
