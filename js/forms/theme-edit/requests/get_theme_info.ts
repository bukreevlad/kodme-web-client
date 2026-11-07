// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";

/**
 * ***************************************************************************
 * Данные запроса информации о теме оформления.
 ***************************************************************************
 */
export interface GetThemeInfoData {

    /** Id темы. */
    theme_id: string;

}

/**
 * ***************************************************************************
 * Тема оформления — полезная нагрузка ответа "[theme]: get info".
 *
 * Поля — только те, что реально читает форма theme-edit (см. index.ts:
 * _update наполняет форму значениями темы).
 ***************************************************************************
 */
export interface ThemeInfo {

    /** Название темы. */
    name: string;

    /** CSS-стили темы. */
    style: string;

    /** Публичная ли тема (переключатель «Открытая/Закрытая»). */
    is_public: boolean;

}

/**
 * ***************************************************************************
 * Запрос информации о теме оформления.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. index.ts, _onBeforeOpen).
 * @param data - Данные запроса.
 * @returns Ответ сервера информацией о теме.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 ***************************************************************************
 */
export async function getThemeInfoRequest(data: GetThemeInfoData): Promise<Answer<ThemeInfo>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<ThemeInfo>("[theme]: get info", data);

}
