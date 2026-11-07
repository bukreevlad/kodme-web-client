// Импортируем config (секции вкладок)
import { MEDIA_SECTIONS } from "../config/media_sections.js";

// Импортируем requests
import { createSectionRequest } from "./section.js";

// Импортируем типы
import type { SectionPageResponse, SectionRequestData, SectionRequestFn } from "./section.js";

/**
 * ***************************************************************************
 * Готовые запросы, собранные фабрикой по конфигу секций.
 *
 * Раньше это были шесть файлов requests/get_*.js, различавшихся только
 * именем события. Теперь карта строится из MEDIA_SECTIONS: новая вкладка
 * получает рабочий запрос автоматически, отдельный файл не нужен.
 ***************************************************************************
 */
export const REQUESTS: Record<string, SectionRequestFn> = Object.fromEntries(
    MEDIA_SECTIONS.map(section => [section.id, createSectionRequest(section.event)])
);

/**
 * ***************************************************************************
 * Запрос секции профиля канала.
 * @param id - Идентификатор секции (вкладки).
 * @param data - Данные запроса.
 * @returns Ответ сервера.
 * @throws Error, если секции нет в конфиге (сломан MEDIA_SECTIONS).
 * ***************************************************************************
 */
export function sectionRequest(id: string, data?: SectionRequestData): Promise<SectionPageResponse> {

    const request = REQUESTS[id];
    if (!request) throw new Error(`Секция не найдена: ${id}`);

    return request(data);

}
