// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем requests
import { createShareLinkRequest } from "../requests/create_share_link.js";
import type { CreateShareLinkData } from "../requests/create_share_link.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { CloudAccessLevel, CloudItem, CloudShareLinkRow } from "../types.js";

/**
 * Параметры создаваемой ссылки.
 */
export interface CreateShareLinkPayload {

    /** Id пользователей, которым доступна ссылка. */
    user_ids?: string[];

    /** Уровень доступа ["read" | "write"]. */
    access_level?: CloudAccessLevel;

    /** Дата истечения срока (ISO-строка, null — без ограничений). */
    expires_at?: string | null;

}

/**
 * ***************************************************************************
 * Создание ссылки (общий доступ) на папку или файл.
 * @param item - Папка или файл.
 * @param linkPayload - Параметры ссылки.
 * @returns Ответ сервера (созданная ссылка) либо null при ошибке.
 * ***************************************************************************
 */
export async function createShareLinkHandler(
    item: CloudItem,
    linkPayload: CreateShareLinkPayload = {}
): Promise<Answer<CloudShareLinkRow> | null> {

    try {

        // Запрос на сервер
        let data: CreateShareLinkData = {
            item_id: item.id,
            user_ids: linkPayload.user_ids || [],
            access_level: linkPayload.access_level || "read",
            expires_at: linkPayload.expires_at || null
        };

        let response = await createShareLinkRequest(data);

        return response;

    } catch (error) {
        Logger.error(error);
        return null;
    }

}
