// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { AvatarImageDocument } from "../../../components/avatars.js";

/**
 * Данные запроса информации о канале.
 */
export interface GetChannelInfoData {

    /** Id канала. */
    channel_id: string;

}

/**
 * Ответ сервера: объект канала (читает _update формы — только эти поля
 * нужны для шапки профиля; остальные сервер может присылать дополнительно).
 */
export interface ChannelProfileResponse {

    /** Id канала. */
    id: string;

    /** Тип канала (server/constants/channels.ts: 1,8 — диалоги, 2 — группа, 3 — канал, 4 — тема, 5 — избранное). */
    type: number;

    /** Ссылка на канал (@username или публичная ссылка). */
    link?: string;

    /** Описание канала. */
    about?: string;

    /** Отображаемое имя. */
    display_name?: string;

    /** Id создателя канала (по нему показывается кнопка настроек). */
    created_user_id?: string;

    /** Id пользователя-собеседника (для диалогов: типы 1 и 8 — аватар берётся от него). */
    display_user_id?: string;

    /** Документ изображения аватара. */
    avatar?: AvatarImageDocument | null;

}

/**
 * ***************************************************************************
 * Запрос информации о канале для шапки профиля.
 * @param data - Данные запроса.
 * @returns Ответ сервера с объектом канала.
 * @throws Error сервера — разбирает вызывающий код (_onBeforeOpen формы).
 * ***************************************************************************
 */
export async function getChannelInfoRequest(data: GetChannelInfoData): Promise<Answer<ChannelProfileResponse>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck("[channel]: get info", data);

}
