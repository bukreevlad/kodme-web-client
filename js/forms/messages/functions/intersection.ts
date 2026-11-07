// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { Messages } from "../index.js";

/**
 * ***************************************************************************
 * intersection - единый обработчик видимости строк окна чата: реакции
 * (form.reactionsUpdater.track) и отметка о прочтении (lastViewedBatcher).
 * @param entries - IntersectionObserverEntry.
 * @param observer - IntersectionObserver.
 * @param form - Экземпляр формы.
 * @returns void
 * ***************************************************************************
 */
export function intersection(entries: IntersectionObserverEntry[], observer: IntersectionObserver, form: Messages): void {

    try {

        // Канал обязателен для отметок прочтения (создаётся вместе с формой)
        const channel = form.channel;
        if (!channel) return;

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
            if (!message || message.is_temporary) {
                // Логируем, если обсервер сработал, но чтение заблокировано стейтом
                if (entry.isIntersecting) {
                    Logger.debug(`[app][messages][observer]: Элемент попал в видимость, но ПРОПУЩЕН. data-id в DOM: "${messageId}", Найдено в store: ${!!message}, is_temporary: ${message?.is_temporary}`);
                }
                continue;
            }

            // Проверяем пересечение объекта
            const isVisible = entry.isIntersecting || entry.intersectionRatio > 0;
            if (!isVisible) {
                // Если нам пришел false, но это просто "дребезг" на границе 10% порога
                continue;
            }

            // Обновляем реакции сообщения.
            // Менеджер реакций принадлежит форме: общий модульный таймер
            // переключался на последний проскоривший канал, и в двух
            // открытых чатах один из них переставал обновлять реакции.
            form.reactionsUpdater?.track(messageId, entry.isIntersecting);

            // Если не видно элемент
            if (!entry.isIntersecting) continue;

            Logger.debug(`[app][messages][observer]: Элемент в зоне видимости. Проверяем лимиты прочтения для messageId: ${messageId}. Текущий last_viewed_message_id в форме: ${channel.last_viewed_message_id}`);

            // Проверяем, нужно ли обновлять статус прочтения
            if (!channel.last_viewed_message_id || channel.last_viewed_message_id < messageId) {

                Logger.debug(`[app][messages][observer]: Планируем отметку о прочтении для messageId: ${messageId}`);

                // Фиксируем отметку в форме (чтобы не заходить в этот IF снова).
                // Счётчик непрочитанных здесь НЕ трогаем: его пересчитывает
                // батчер при отправке, иначе значение уменьшалось бы дважды
                // (здесь и в flushCallback), а бейдж в списке чатов «схлопывался»
                // быстрее, чем реально прочитаны сообщения.
                channel.last_viewed_message_id = messageId;

                // Отметку НЕ отправляем сразу: при быстром скролле обсервер
                // срабатывает десятки раз подряд, и пользователь выбирал лимит
                // запросов `[message]: update last viewed message`. Бэтчер на
                // форме отправляет одно значение — на максимальный messageId.
                form.lastViewedBatcher?.schedule(messageId);

            } else {
                Logger.debug(`[app][messages][observer]: Отметка НЕ обновляется для messageId: ${messageId}. Он меньше или равен текущему прочитанному.`);
            }

        }

    } catch (error) {
        Logger.error(error);
    }

}
