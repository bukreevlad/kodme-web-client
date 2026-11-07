// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { CloudFolderRow } from "../types.js";

/**
 * ***************************************************************************
 * Данные запроса создания папки.
 ***************************************************************************
 */
export interface CreateFolderData {

    /** Id родительской папки (корень облака, если не передан). */
    parent_id?: string | null;

    /** Id ссылки (для общего доступа, нужен доступ write). */
    link_id?: string | null;

    /** Название папки. */
    name: string;

}

/**
 * ***************************************************************************
 * Создание папки в своём облаке либо внутри общего поддерева по ссылке.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. dialogs/create_folder/handlers/create.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера созданной папкой.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function createFolderRequest(data: CreateFolderData): Promise<Answer<CloudFolderRow>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<CloudFolderRow>("[cloud]: create folder", data);

}
