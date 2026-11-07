// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * Данные запроса обновления пака стикеров.
 */
export interface UpdatePakRequestData {

    /** Id пака. */
    pak_id: string;

    /** Новое название (не передано — без изменений). */
    name?: string;

    /** Новое описание (null — очистить, не передано — без изменений). */
    about?: string | null;

    /** Новая публичность (не передана — без изменений). */
    is_public?: boolean;

}

/**
 * Данные ответа обновления пака: строка пака с флагами.
 */
export interface UpdatePakResult {

    /** Id пака. */
    id: string;

    /** Название пака. */
    name: string;

    /** Описание пака. */
    about: string | null;

    /** Публичность пака. */
    is_public: boolean;

    /** Id автора пака. */
    created_user_id: string;

    /** Дата создания (ISO). */
    created_at: string;

    /** Имя автора. */
    author_name: string | null;

    /** Текущий пользователь — автор пака. */
    is_author: boolean;

    /** Текущий пользователь подписан на пак. */
    is_member: boolean;

}

/**
 * ***************************************************************************
 * Запрос обновления метаданных пака (название, описание, публичность).
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/save.ts).
 * @param data - Данные запроса.
 * @returns Обновлённый пак с флагами.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function updatePakRequest(data: UpdatePakRequestData): Promise<Answer<UpdatePakResult>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<UpdatePakResult>("[sticker]: update pak", data);

}
