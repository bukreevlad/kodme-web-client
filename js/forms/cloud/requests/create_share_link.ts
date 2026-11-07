// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT_HEAVY } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { CloudAccessLevel, CloudShareLinkRow } from "../types.js";

/**
 * ***************************************************************************
 * Данные запроса создания ссылки общего доступа.
 ***************************************************************************
 */
export interface CreateShareLinkData {

    /** Id папки или файла. */
    item_id: string;

    /** Id пользователей, которым доступна ссылка. */
    user_ids: string[];

    /** Уровень доступа ["read" | "write"]. */
    access_level: CloudAccessLevel;

    /** Дата истечения срока (ISO-строка, null — без ограничений). */
    expires_at: string | null;

}

/**
 * ***************************************************************************
 * Создание ссылки общего доступа на папку или файл.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/create_share_link.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера созданной ссылкой.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function createShareLinkRequest(data: CreateShareLinkData): Promise<Answer<CloudShareLinkRow>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT_HEAVY)
        .emitWithAck<CloudShareLinkRow>("[cloud]: create share link", data);

}
