// Импортируем handlers
import { openShareLinkHandler } from "./open_share_link.js";

// Импортируем типы
import type { CloudAvailableLink } from "../types.js";
import type { Cloud } from "../index.js";

/**
 * ***************************************************************************
 * Открытие ссылки из «Доступное для меня»: для папки — переходим в режим
 * общего доступа, для файла — открываем окно с информацией о файле.
 * @param form - Экземпляр формы.
 * @param linkData - Данные доступной ссылки.
 * @returns Успешно ли открыта ссылка.
 * ***************************************************************************
 */
export async function openAvailableLinkHandler(form: Cloud, linkData: CloudAvailableLink): Promise<boolean> {

    // Открываем ссылку общего доступа
    return await openShareLinkHandler(form, linkData.link);

}
