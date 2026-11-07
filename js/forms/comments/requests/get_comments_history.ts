// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { CommentRecord, CommentsDirection, EntityType } from "../types.js";

/**
 * Данные запроса страницы комментариев.
 */
export interface GetCommentsHistoryData {

    /** Id поста (сообщения). */
    entity_id: string;

    /** Тип сущности ("message"). */
    entity_type: EntityType;

    /** Опора на сохранённую позицию возврата в ветку. */
    after_last_viewed_comment?: boolean;

    /** Направление пагинации ["prev" | "next"]. */
    direction?: CommentsDirection;

    /** Id курсора пагинации. */
    cursor_id?: string | null;

    /** Размер порции элементов. */
    offset?: number;

}

/**
 * Ответ `[comment]: get history`: страница комментариев и границы ветки.
 */
export interface GetCommentsHistoryResult {

    /** Id поста. */
    entity_id: string;

    /** Тип сущности. */
    entity_type: string;

    /** Сохранённая позиция возврата (null — читать ещё не начинали). */
    last_viewed_comment_id: string | null;

    /** Самый старый комментарий ветки (граница подгрузки prev). */
    first_comment_id: string | null;

    /** Самый новый комментарий ветки (граница подгрузки next). */
    last_comment_id: string | null;

    /** Страница комментариев (с реакциями, вложениями, ответами). */
    comments: CommentRecord[];

}

/**
 * ***************************************************************************
 * Получить страницу комментариев поста.
 *
 * Порядок в ответе зависит от `direction`: `prev` — по убыванию `id`,
 * иначе — по возрастанию (клиент сортирует страницу перед вставкой).
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (`functions/*_comments.js`).
 * @param data - Данные запроса.
 * @returns Страница комментариев и границы ветки.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function getCommentsHistoryRequest(data: GetCommentsHistoryData): Promise<Answer<GetCommentsHistoryResult>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<GetCommentsHistoryResult>("[comment]: get history", data);

}
