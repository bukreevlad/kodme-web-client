// Импортируем events
import { subscribeBroadcastUpdate } from "./update.js";

/**
 * ***************************************************************************
 * Подписки на события трансляций.
 * ***************************************************************************
 */
export function subscribeBroadcasts(): void {

    subscribeBroadcastUpdate();

}
