// Импортируем events
import { subscribeOnlineStatus } from "./online_status.js";

/**
 * ***************************************************************************
 * Подписки на события пользователей (онлайн-статусы).
 * ***************************************************************************
 */
export function subscribeUsers(): void {

    subscribeOnlineStatus();

}
