// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { SecretChatsManager } from "../../../core/managers/secret_chats_manager.js";

// Импортируем типы
import type { SecretChat } from "../index.js";

/**
 * ***************************************************************************
 * intersection - обработчик видимости строк окна секретного чата:
 * отметка о прочтении входящих сообщений (батчер квитанций).
 * @param entries - IntersectionObserverEntry.
 * @param observer - IntersectionObserver.
 * @param form - Экземпляр формы.
 * @returns void
 * ***************************************************************************
 */
export function intersection(entries: IntersectionObserverEntry[], observer: IntersectionObserver, form: SecretChat): void {

    try {

        // Чат обязателен для отметок прочтения (создаётся вместе с формой)
        if (!form.chat) return;

        // Проходим по элементам
        for (let entry of entries) {

            // Пропускаем элементы, которых нет в DOM
            if (!entry.target.isConnected) continue;

            // Устанавливаем параметры
            let messageId = entry.target.getAttribute("data-id");

            // Без data-id сообщение не идентифицировать — пропускаем
            if (messageId == null) continue;

            let message = form.store.get(messageId);

            // Если сообщение не найдено
            if (!message) {
                if (entry.isIntersecting) {
                    Logger.debug(`[app][secret-chat][observer]: Элемент попал в видимость, но ПРОПУЩЕН. data-id в DOM: "${messageId}"`);
                }
                continue;
            }

            // Проверяем пересечение объекта
            const isVisible = entry.isIntersecting || entry.intersectionRatio > 0;
            if (!isVisible) {
                // Если нам пришел false, но это просто "дребезг" на границе порога
                continue;
            }

            // Если не видно элемент
            if (!entry.isIntersecting) continue;

            // Самоуничтожение входящего стартует от просмотра
            // (у получателя — по локальному таймеру после просмотра)
            if (message.sender === "peer" && message.self_destruct) {
                SecretChatsManager.instance?.touchSelfDestruct(form.chatId, messageId).catch((error) => {
                    Logger.error("[app][secret-chat][observer]: ошибка запуска самоуничтожения:", error);
                });
            }

            // Квитанция «прочитано» — только для входящих и только однажды:
            // статус "read" ставит батчер после успешной отправки
            if (message.sender !== "peer" || message.status === "read") continue;

            Logger.debug(`[app][secret-chat][observer]: Планируем квитанцию о прочтении для messageId: ${messageId}`);

            // Квитанции копятся в батчере и уходят одним control-кадром
            form.readReceiptsBatcher?.schedule(messageId);

        }

    } catch (error) {
        Logger.error(error);
    }

}
