// Импортируем events
import { subscribeCallIncoming } from "./incoming.js";
import { subscribeCallDeclined } from "./declined.js";

/**
 * ***************************************************************************
 * Подписки на события звонков (входящий, отклонён/отменён).
 * ***************************************************************************
 */
export function subscribeCall(): void {

    subscribeCallIncoming();
    subscribeCallDeclined();

}
