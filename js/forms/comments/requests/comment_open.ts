// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { EntityType } from "../types.js";
import type { MessageData } from "../../messages/components/types.js";

/**
 * Данные запроса открытия формы комментариев.
 */
export interface CommentOpenData {

    /** Id поста (сообщения). */
    entity_id: string;

    /** Тип сущности ("message"). */
    entity_type: EntityType;

}

/**
 * Ответ `[comment]: open`: гидратированный пост + позиция возврата.
 */
export interface CommentOpenResult {

    /** Пост (данные сообщения: автор, текст, вложения, счётчик). */
    message: MessageData;

    /** Сохранённая позиция возврата (null — читать ещё не начинали). */
    last_viewed_comment_id: string | null;

    /** Можно ли писать в ветку (оба is_commenting: канала и поста). */
    is_commenting_allowed: boolean;

}

/**
 * ***************************************************************************
 * Открыть форму комментариев поста.
 *
 * Сервер создаёт запись о читателе ветки (ленивый UPSERT), подписывает
 * соединение на обновления канала и возвращает пост + позицию возврата.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код.
 * @param data - Данные запроса.
 * @returns Данные поста и позиция возврата.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function commentOpenRequest(data: CommentOpenData): Promise<Answer<CommentOpenResult>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<CommentOpenResult>("[comment]: open", data);

}
