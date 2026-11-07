// Импортируем config
import { Socket } from "../../config/socket.js";

// Импортируем типы
import type { Answer } from "../../types/domain.js";

/**
 * Данные запроса "[secret-chat]: invite".
 */
export interface SecretChatInviteData {
    /** Id секретного чата. */
    chat_id: string;
    /** Устройство-получатель (session_id). */
    target_device_id: string;
    /** Публичный ключ идентичности (base64url). */
    identity_key: string;
    /** Эфемерный публичный ключ (base64url). */
    ephemeral_key: string;
    /** Таймер самоуничтожения сообщений (null — выключен). */
    self_destruct: string | null;
}

/**
 * Данные запроса "[secret-chat]: accept".
 */
export interface SecretChatAcceptData {
    /** Id секретного чата. */
    chat_id: string;
    /** Устройство-получатель (session_id инициатора). */
    target_device_id: string;
    /** Публичный ключ идентичности (base64url). */
    identity_key: string;
    /** Эфемерный публичный ключ (base64url). */
    ephemeral_key: string;
}

/**
 * Данные запроса "[secret-chat]: signal".
 */
export interface SecretChatSignalData {
    /** Id секретного чата. */
    chat_id: string;
    /** Устройство-получатель (session_id). */
    target_device_id: string;
    /** Тип сигнала: offer / answer / candidate / hangup / rekey. */
    type: string;
    /** SDP (для offer/answer). */
    sdp: string | null;
    /** ICE-candidate (JSON-строка). */
    candidate: string | null;
}

/**
 * Данные запроса "[secret-chat]: close".
 */
export interface SecretChatCloseData {
    /** Id секретного чата. */
    chat_id: string;
    /** Устройство-получатель (session_id). */
    target_device_id: string;
}

/**
 * Данные запроса "[secret-chat]: decline".
 */
export interface SecretChatDeclineData {
    /** Id секретного чата (приглашения). */
    chat_id: string;
    /** Устройство-получатель (session_id). */
    target_device_id: string;
    /** Причина: declined (отклонено) / taken (принято на другом устройстве) / cancelled (отменено) / timeout (истекло время). */
    reason: string;
}

/**
 * ***************************************************************************
 * Приглашение в секретный чат (обмен публичными ключами handshake).
 * @param {SecretChatInviteData} data - Данные запроса.
 * @returns {Promise<Answer>} - Ответ сервера.
 * ***************************************************************************
 */
export async function inviteRequest(data: SecretChatInviteData): Promise<Answer<{ delivered: boolean }>> {
    return Socket.client.timeout(5000).emitWithAck<{ delivered: boolean }>("[secret-chat]: invite", data);
}

/**
 * ***************************************************************************
 * Принятие секретного чата (ответный эфемерный ключ handshake).
 * @param {SecretChatAcceptData} data - Данные запроса.
 * @returns {Promise<Answer>} - Ответ сервера.
 * ***************************************************************************
 */
export async function acceptRequest(data: SecretChatAcceptData): Promise<Answer<{ delivered: boolean }>> {
    return Socket.client.timeout(5000).emitWithAck<{ delivered: boolean }>("[secret-chat]: accept", data);
}

/**
 * ***************************************************************************
 * Ретрансляция WebRTC-сигнала (SDP/ICE) устройству собеседника.
 * @param {SecretChatSignalData} data - Данные запроса.
 * @returns {Promise<Answer>} - Ответ сервера.
 * ***************************************************************************
 */
export async function signalRequest(data: SecretChatSignalData): Promise<Answer<{ delivered: boolean }>> {
    return Socket.client.timeout(5000).emitWithAck<{ delivered: boolean }>("[secret-chat]: signal", data);
}

/**
 * ***************************************************************************
 * Удаление секретного чата у обоих участников.
 * @param {SecretChatCloseData} data - Данные запроса.
 * @returns {Promise<Answer>} - Ответ сервера.
 * ***************************************************************************
 */
export async function closeRequest(data: SecretChatCloseData): Promise<Answer<{ delivered: boolean }>> {
    return Socket.client.timeout(5000).emitWithAck<{ delivered: boolean }>("[secret-chat]: close", data);
}

/**
 * ***************************************************************************
 * Отказ от приглашения секретного чата (или его снятие) с причиной.
 * @param {SecretChatDeclineData} data - Данные запроса.
 * @returns {Promise<Answer>} - Ответ сервера.
 * ***************************************************************************
 */
export async function declineRequest(data: SecretChatDeclineData): Promise<Answer<{ delivered: boolean }>> {
    return Socket.client.timeout(5000).emitWithAck<{ delivered: boolean }>("[secret-chat]: decline", data);
}

/**
 * ***************************************************************************
 * Подписка на присутствие устройств пользователя.
 * @param {string} userId - Id пользователя.
 * @returns {Promise<Answer>} - Ответ сервера со снимком онлайн-устройств.
 * ***************************************************************************
 */
export async function presenceSubscribeRequest(userId: string): Promise<Answer<{ user_id: string; devices: string[] }>> {
    return Socket.client.timeout(5000).emitWithAck<{ user_id: string; devices: string[] }>("[secret-chat]: presence subscribe", { user_id: userId });
}

/**
 * ***************************************************************************
 * Отписка от присутствия устройств пользователя.
 * @param {string} userId - Id пользователя.
 * @returns {Promise<Answer>} - Ответ сервера.
 * ***************************************************************************
 */
export async function presenceUnsubscribeRequest(userId: string): Promise<Answer<{ user_id: string }>> {
    return Socket.client.timeout(5000).emitWithAck<{ user_id: string }>("[secret-chat]: presence unsubscribe", { user_id: userId });
}
