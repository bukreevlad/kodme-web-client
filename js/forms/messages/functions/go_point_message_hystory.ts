// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем requests
import { getMessagesHistoryRequest } from "../requests/get_messages_history.js";

// Импортируем типы
import type { MessageRecord, MessageStoreAddOptions } from "../types.js";
import type { Messages } from "../index.js";

/**
 * Минимальный хост перехода к сообщению: форма сообщений и данные целевого
 * сообщения. Пользуется им форма профиля канала (см.
 * `forms/channel-profile/functions/go_to_message.ts`); поле element
 * опциально — блок ответа/пересылки его передаёт.
 */
export interface GoPointMessageHost {

    /** Экземпляр формы сообщений. */
    form: Messages;

    /** Данные целевого сообщения (функция читает id и channel_id). */
    data: MessageRecord;

    /** Корневой элемент блока (функцией не используется). */
    element?: HTMLElement;

}

// Вспомогательная функция для скролла и подсветки всех копий сообщения
function highlightElements(reply: MessageRecord): void {
    if (!reply || !reply.__domElements__ || !Array.isArray(reply.__domElements__)) return;

    reply.__domElements__.forEach((element, index) => {
        if (!element) return;

        // Прокручиваем экран только к первому найденному элементу
        if (index === 0) {
            element.scrollIntoView({ block: "center", inline: "nearest" });
        }

        // Подсвечиваем каждую копию
        element.classList.remove("backlight");
        void element.offsetWidth;
        element.classList.add("backlight");
    });
}

/**
 * ***************************************************************************
 * goPointMessageHistory - переход к сообщению, на которое дан ответ/пересылка
 * либо к сообщению-владельцу вложения:
 * если сообщение уже в окне — подсвечиваем его копии, иначе пересобираем
 * окно вокруг него запросами истории в обе стороны.
 * @param reply - Хост перехода: форма сообщений и данные целевого сообщения.
 * @returns void
 * ***************************************************************************
 */
export async function goPointMessageHistory(reply: GoPointMessageHost): Promise<void> {

    try {

        // Получаем сообщение из Store
        let message = reply.form.store.get(reply.data.id);

        // Если ответ найден в текущем сторе
        if (message) {
            highlightElements(message);
        } else {

            // Переход к сообщению — действие в контексте канала:
            // без id каналы историю вокруг сообщения не загрузить
            if (reply.data.channel_id === undefined) return;

            // Получаем предыдущие сообщения
            let getPrevMessages = await getMessagesHistoryRequest({
                direction: "prev",
                channel_id: reply.data.channel_id,
                cursor_id: reply.data.id,
                offset: 15
            });

            // Получаем следующие сообщения
            let getNextMessages = await getMessagesHistoryRequest({
                direction: "next",
                channel_id: reply.data.channel_id,
                cursor_id: reply.data.id,
                offset: 15
            });

            // Очищаем Store формы
            reply.form.store.removeAll();

            // Направление вставки пробрасывается подписчикам item::added
            const prevOptions: MessageStoreAddOptions = { direction: "prev" };
            const nextOptions: MessageStoreAddOptions = { direction: "next" };

            // Отображаем предыдущие сообщения
            getPrevMessages.data.forEach(message => {
                reply.form.store.add(message, prevOptions);
            });

            // Отображаем само сообщение ответа
            reply.form.store.add(reply.data, nextOptions);

            // Отображаем следующие сообщения
            getNextMessages.data.forEach(message => {
                reply.form.store.add(message, nextOptions);
            });

            // Снова запрашиваем элемент из стора, так как он только что создался
            let updatedReply = reply.form.store.get(reply.data.id);

            if (updatedReply) {
                highlightElements(updatedReply);
            }

        }

    } catch (error) {
        Logger.error(error);
    }

}
