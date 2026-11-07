// Импортируем events
import { subscribeMessages } from "./messages/index.js";

/**
 * ***************************************************************************
 * Подписки сокета формы онлайн-чата (сокет создаёт сама форма в _init).
 * ***************************************************************************
 */
export function subscribeSocketEvents(): void {

    subscribeMessages();

}
