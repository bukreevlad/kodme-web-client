// Импортируем utils

// Импортируем forms
import { FormsRegistry } from "../../../core/managers/forms_registry.js";
import { Main } from "../index.js";

// Импортируем functions
import { getUpdates } from "./get_updates.js";

// Импортируем events (апплайеры событий к локальным хранилищам и UI)
import { applyMessageNew } from "../events/socket/messages/new.js";
import { applyMessageUpdate } from "../events/socket/messages/update.js";
import { applyMessageRemove } from "../events/socket/messages/remove.js";
import { applyClearHistory } from "../events/socket/messages/clear_hystory.js";
import { applyChannelNew } from "../events/socket/channels/new.js";
import { applyChannelUpdate } from "../events/socket/channels/update.js";
import { applyChannelRemove } from "../events/socket/channels/remove.js";
import { applyModerationCleaned } from "../events/socket/moderation/cleaned.js";
import { applyMemberBanned } from "../events/socket/moderation/member_banned.js";
import { applyMemberUnbanned } from "../events/socket/moderation/member_unbanned.js";

// Импортируем requests
import { getMessageDataRequest } from "../../messages/requests/get_data.js";
import { getChannelInfoRequest } from "../../channel-profile/requests/get_channel_info.js";

// Импортируем db
import { channelsTable } from "../db.js";

// Импортируем типы
import { isMessageRecord, isRecord } from "../types.js";
import { ChannelFeedEvent } from "../../../types/domain.js";

/**
 * ***************************************************************************
 * Применить событие ленты канала к локальным хранилищам и UI.
 *
 * Единая точка применения для живого толчка `[channel]: feed` и догонки
 * `[channel]: get updates`: событие либо несёт готовые данные в payload.data,
 * либо дозапрашивается. Правила pts: дубль (pts не новее последнего
 * применённого) пропускается, пропуск в ленте у живого события уводит в
 * догонку, финальный pts фиксируется в хранилище канала.
 * @param event - Событие ленты.
 * @param live - Событие пришло живым толчком (а не догонкой).
 * ***************************************************************************
 */
export async function applyChannelFeedEvent(event: ChannelFeedEvent, live: boolean): Promise<void> {

    // Правила pts только для известного канала: новое событие канала
    // (channel_created) приходит до того, как канал появится в хранилище
    const channelDB = await channelsTable().get(event.channel_id);
    if (channelDB) {

        // Дубль — событие уже применено
        if (event.pts <= (channelDB.last_pts ?? 0)) return;

        // Пропуск в ленте: живое событие догоняется целиком — догонка
        // вернёт недостающие события тем же порядком
        if (event.pts > (channelDB.last_pts ?? 0) + 1) {
            const main = FormsRegistry.getOwner<Main>("main");

            if (live && main) await getUpdates(main);
            if (live) return;
        }

    }

    // Применяем событие по его типу
    await dispatch(event, live);

    // Фиксируем точку ленты канала
    await channelsTable().update(event.channel_id, { last_pts: event.pts });
    const storeChannel = FormsRegistry.getOwner<Main>("main")?.store.get(event.channel_id);
    if (storeChannel) FormsRegistry.getOwner<Main>("main")?.store.update(event.channel_id, { ...storeChannel, last_pts: event.pts });

}

/**
 * ***************************************************************************
 * Раздать событие аплайеру по типу.
 * @param event - Событие ленты.
 * @param live - Событие пришло живым толчком.
 * ***************************************************************************
 */
async function dispatch(event: ChannelFeedEvent, live: boolean): Promise<void> {

    switch (event.type) {

        // Новое или изменённое сообщение: готовое из payload.data либо дозапрос
        case "message_new":
        case "message_edit": {
            const message = await resolveMessage(event);
            if (!message) return;
            if (event.type === "message_new") await applyMessageNew(message, live);
            else await applyMessageUpdate(message);
            return;
        }

        // Удалены сообщения (payload несёт массив id)
        case "message_deleted": {
            const ids = messageIds(event);
            for (const messageId of ids) {
                await applyMessageRemove({ channel_id: event.channel_id, message_id: messageId, pts: event.pts });
            }
            return;
        }

        // История канала очищена для всех
        case "history_cleared":
            await applyClearHistory({ channel_id: event.channel_id });
            return;

        // Модерация почистила сообщения автора
        case "messages_cleaned": {
            const authorId = stringField(event, "author_id");
            if (!authorId) return;
            await applyModerationCleaned({ channel_id: event.channel_id, user_id: authorId, pts: event.pts });
            return;
        }

        // Канал создан или его настройки изменились: данные дозапрашиваем
        case "channel_created":
        case "channel_updated": {
            const response = await getChannelInfoRequest({ channel_id: event.channel_id });
            if (!response.status || !response.data) return;
            if (event.type === "channel_created") await applyChannelNew(response.data);
            else await applyChannelUpdate(response.data);
            return;
        }

        // В группе создана тема: добавляем тему (id темы — в payload,
        // события ленты темы группе недоступны: id темы ей неизвестен)
        case "topic_created": {
            const topicId = stringField(event, "channel_id");
            if (!topicId) return;
            const response = await getChannelInfoRequest({ channel_id: topicId });
            if (response.status && response.data) await applyChannelNew(response.data);
            return;
        }

        // Канал удалён — убираем его из хранилищ
        case "channel_removed":
            await applyChannelRemove({ channel_id: event.channel_id });
            return;

        // Участники: бан/разбан обновляет списки участников
        case "member_banned":
        case "member_unbanned": {
            const userId = stringField(event, "user_id");
            if (!userId) return;
            const payload = { channel_id: event.channel_id, user_id: userId };
            if (event.type === "member_banned") await applyMemberBanned(payload);
            else await applyMemberUnbanned(payload);
            return;
        }

        // Присоединение/выход участника: списки участников перечитываются
        // при открытии формы — локальные хранилища событие не трогает
        case "member_joined":
        case "member_left":
            return;

    }

}

/**
 * ***************************************************************************
 * Получить сообщение события: готовое из payload.data либо дозапросом по id.
 * @param event - Событие ленты (message_new / message_edit).
 * @returns Запись сообщения либо null, если данные недоступны.
 * ***************************************************************************
 */
async function resolveMessage(event: ChannelFeedEvent): Promise<unknown> {

    // Готовое сообщение живого толчка
    const data = event.payload.data;
    if (isMessageRecord(data)) return data;

    // Догонка несёт только id — дозапрашиваем сообщение
    const messageId = stringField(event, "message_id");
    if (!messageId) return null;
    const response = await getMessageDataRequest({ message_id: messageId });
    return response.status && isMessageRecord(response.data) ? response.data : null;

}

/**
 * ***************************************************************************
 * Извлечь массив id сообщений из payload события (мусор отбрасываем).
 * @param event - Событие ленты (message_deleted).
 * @returns Массив id сообщений.
 * ***************************************************************************
 */
function messageIds(event: ChannelFeedEvent): string[] {

    const value = event.payload.message_ids;
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];

}

/**
 * ***************************************************************************
 * Извлечь строковое поле из payload события.
 * @param event - Событие ленты.
 * @param name - Имя поля.
 * @returns Строковое значение либо пустая строка.
 * ***************************************************************************
 */
function stringField(event: ChannelFeedEvent, name: string): string {

    const value = isRecord(event.payload) ? event.payload[name] : undefined;
    return typeof value === "string" && value ? value : "";

}

