// Импортируем сторонние пакеты
import Dexie from "dexie";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { SecretChatsManager } from "../../../core/managers/secret_chats_manager.js";
import { secretChatsTable, secretMessagesTable } from "../../../utils/secret_chats/secret_chats_db.js";

// Импортируем functions
import { getSessionUserId } from "./session_identity.js";
import { decryptSecretMessage } from "../../secret-chat/functions/decrypt_message.js";

// Импортируем requests
import { getUserInfoRequest } from "../../user-profile/requests/get_user_info.js";

// Импортируем типы
import type { AvatarImageDocument } from "../../../components/avatars.js";
import type { SecretChatRecord, SecretMessageRecord } from "../../../types/secret_chats.js";
import type { Main } from "../index.js";
import type { ChannelRecord, SecretPreviewMessage, AddPageOptions } from "../types.js";

/** Кэш профилей собеседников секретных чатов (id пользователя → профиль). */
const peerIdentityCache = new Map<string, { display_name: string; avatar: AvatarImageDocument | null }>();

/** Очереди обновления строк по чатам (обновления одного чата идут по очереди). */
const rowUpdates = new Map<string, Promise<void>>();

/**
 * ***************************************************************************
 * Профиль собеседника секретного чата (имя и аватар для строки списка).
 * Результат кэшируется: иначе каждое обновление строки дёргало бы запрос
 * профиля заново.
 * @param userId - Id собеседника.
 * @returns Имя и аватар собеседника (id — фолбэк имени).
 * ***************************************************************************
 */
async function getPeerIdentity(userId: string): Promise<{ display_name: string; avatar: AvatarImageDocument | null }> {

    const cached = peerIdentityCache.get(userId);
    if (cached) return cached;

    const identity = { display_name: userId, avatar: null as AvatarImageDocument | null };
    try {

        const response = await getUserInfoRequest({ user_id: userId });
        if (response.status && response.data) {
            identity.display_name = response.data.display_name;
            identity.avatar = response.data.avatar ?? null;
        }

    } catch (error) {
        Logger.debug("[app][main][secret-chats]: профиль собеседника недоступен.", error);
    }

    peerIdentityCache.set(userId, identity);
    return identity;

}

/**
 * ***************************************************************************
 * Превью последнего сообщения секретного чата: payload расшифровывается и
 * отдаётся в форме, которую читает компонент превью секретного чата
 * (forms/main/components/secret_chat_last_message.ts).
 * @param record - Запись сообщения из локальной истории.
 * @param chat - Запись секретного чата.
 * @param peer - Профиль собеседника (имя автора входящих).
 * @returns Превью последнего сообщения.
 * ***************************************************************************
 */
async function mapSecretPreview(
    record: SecretMessageRecord,
    chat: SecretChatRecord,
    peer: { display_name: string; avatar: AvatarImageDocument | null }
): Promise<SecretPreviewMessage> {

    // Базовые поля несут время и отправителя даже при сбое расшифровки
    const preview: SecretPreviewMessage = {
        id: record.id,
        channel_id: chat.id,
        created_at: new Date(record.created_at).toISOString(),
        created_user_id: record.sender === "me" ? (getSessionUserId() ?? undefined) : chat.peer_user_id,
        display_name: peer.display_name
    };

    // Расшифровка одного сообщения не должна ронять обновление строки:
    // повреждённый payload оставляет превью без текста и файлов
    try {

        const decrypted = await decryptSecretMessage(record);
        if (decrypted.created_at) preview.created_at = decrypted.created_at;
        if (decrypted.type) preview.type = decrypted.type;
        preview.text = decrypted.text ?? null;
        preview.files = decrypted.files ?? null;

    } catch (error) {
        Logger.error("[app][main][secret-chats]: сообщение не расшифровалось для превью:", error);
    }

    // Ошибка доставки: статус-иконки в превью не показываем
    if (record.status === "failed") preview.is_error_sending = true;

    return preview;

}

/**
 * ***************************************************************************
 * Маппинг записи секретного чата в строку списка главной формы.
 *
 * Строка живёт только в сторе (не в таблице channels): секретный чат —
 * локальная запись, сервер о нём не знает. Превью и время синтезируются из
 * последнего сообщения локальной истории.
 * @param chat - Запись секретного чата.
 * @returns Строка списка либо null (чат закрыт/удалён).
 * ***************************************************************************
 */
export async function mapSecretChatRow(chat: SecretChatRecord): Promise<ChannelRecord | null> {

    // Закрытые чаты в список не показываем
    if (chat.status === "closed") return null;

    // Профиль собеседника
    const peer = await getPeerIdentity(chat.peer_user_id);

    // Последнее сообщение локальной истории — в том же порядке, в котором
    // его показывает лента чата (по времени создания: id разных устройств
    // могут расходиться с их часами)
    const lastRecord = await secretMessagesTable()
        .where("[chat_id+created_at]")
        .between([chat.id, Dexie.minKey], [chat.id, Dexie.maxKey])
        .reverse()
        .first();

    // Превью последнего сообщения (null — пустой чат)
    const lastMessage = lastRecord ? await mapSecretPreview(lastRecord, chat, peer) : null;

    // Число непрочитанных: входящие без статуса "read"
    const unread = await secretMessagesTable()
        .where("chat_id")
        .equals(chat.id)
        .filter((record) => record.sender === "peer" && record.status !== "read")
        .count();

    // Последнее сообщение прочитано собеседником — двойная галочка в превью
    const displayLastViewedId = lastRecord?.status === "read" ? lastRecord.id : null;

    // Бейдж на аватарке: зелёный при живом P2P-соединении, серый иначе
    const isConnected = SecretChatsManager.instance?.getConnectionState(chat.id) === "connected";

    return {
        id: chat.id,
        type: 1,
        is_secret_chat: true,
        display_user_id: chat.peer_user_id,
        display_name: peer.display_name,
        display_user_is_online: isConnected,
        avatar: peer.avatar,
        last_secret_message: lastMessage,
        last_message_id: lastMessage?.id ?? null,
        total_unread_messages: unread,
        display_last_viewed_message_id: displayLastViewedId
    };

}

/**
 * ***************************************************************************
 * Загрузить секретные чаты в список главной формы (строки для общего списка
 * диалогов). Вызывается из getChannels после очистки стора.
 * @returns Строки списка, отсортировать которые сможет sortChannels.
 * ***************************************************************************
 */
export async function loadSecretChatRows(): Promise<ChannelRecord[]> {

    try {

        const chats = await secretChatsTable().toArray();
        const rows: ChannelRecord[] = [];

        for (const chat of chats) {
            const row = await mapSecretChatRow(chat);
            if (row) rows.push(row);
        }

        return rows;

    } catch (error) {
        Logger.error("[app][main][secret-chats]: не удалось загрузить секретные чаты:", error);
        return [];
    }

}

/**
 * ***************************************************************************
 * Обновить строку секретного чата в списке главной формы: перечитывает
 * запись и историю, добавляет/обновляет/удаляет строку в сторе. Обновления
 * одного чата выполняются строго по очереди — параллельные события не
 * откатывают превью к старому сообщению.
 * @param form - Главная форма.
 * @param chatId - Id секретного чата.
 * @returns Promise<void>
 * ***************************************************************************
 */
export function updateSecretChatRow(form: Main, chatId: string): Promise<void> {

    const previous = rowUpdates.get(chatId) ?? Promise.resolve();
    const task = previous
        .catch(() => undefined)
        .then(() => applySecretChatRow(form, chatId));
    rowUpdates.set(chatId, task.then(() => undefined, () => undefined));
    return task;

}

/**
 * ***************************************************************************
 * Применение обновления строки секретного чата (вызывается очередью
 * updateSecretChatRow).
 * @param form - Главная форма.
 * @param chatId - Id секретного чата.
 * @returns Promise<void>
 * ***************************************************************************
 */
async function applySecretChatRow(form: Main, chatId: string): Promise<void> {

    try {

        const chat = await secretChatsTable().get(chatId);

        // Чат удалён/закрыт — убираем строку из списка
        if (!chat || chat.status === "closed") {
            const existing = form.store.get(chatId);
            if (existing?.is_secret_chat) form.store.remove(chatId);
            return;
        }

        const row = await mapSecretChatRow(chat);
        if (!row) return;

        // Сверяемся со стором ПОСЛЕ всех await: параллельные события
        // (chat::updated + message::added) дублировали строку в списке
        const existing = form.store.get(chatId);
        if (existing) {
            form.store.update(chatId, row);
        } else {

            // Направление вставки пробрасывается подписчикам стора
            const options: AddPageOptions = { direction: "next" };
            form.store.add(row, options);

        }

    } catch (error) {
        Logger.error("[app][main][secret-chats]: не удалось обновить строку чата:", error);
    }

}
