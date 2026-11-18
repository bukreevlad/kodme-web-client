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
 * @returns Ответ сервера (созданная ссылка).
 * @throws Ошибка сервера/сети пробрасывается вызывающему коду —
 *   он показывает тост (см. handlers/create.ts диалога создания ссылки).
 * ***************************************************************************
 */
export async function createShareLinkHandler(
    item: CloudItem,
    linkPayload: CreateShareLinkPayload = {}
): Promise<Answer<CloudShareLinkRow>> {

    // Данные запроса (уровень доступа по умолчанию — чтение)
    let data: CreateShareLinkData = {
        item_id: item.id,
        user_ids: linkPayload.user_ids || [],
        access_level: linkPayload.access_level || "read",
        expires_at: linkPayload.expires_at || null
    };

    return await createShareLinkRequest(data);

}
