// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { StickerPakItem } from "../../sticker-paks/types.js";

/**
 * Данные запроса создания пака стикеров.
 */
export interface CreatePakRequestData {

    /** Название пака (≤ 64 символов). */
    name: string;

    /** Описание пака (≤ 255 символов, null — не заполнять). */
    about?: string | null;

    /** Публичный пак (виден всем) или приватный (только автору). */
    is_public?: boolean;

}

/**
 * ***************************************************************************
 * Запрос создания пака стикеров.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/create.ts).
 * @param data - Данные запроса.
 * @returns Новый пак (в форме, привычной списку).
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function createPakRequest(data: CreatePakRequestData): Promise<Answer<StickerPakItem>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<StickerPakItem>("[sticker]: create pak", data);

}
