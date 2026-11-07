// Импортируем config
import { Socket } from "../../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT_HEAVY } from "../../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../../types/domain.js";

/**
 * Данные запроса информации о приглашении.
 */
export interface GetInviteInfoData {

    /** Ссылка-приглашение. */
    invite: string;

}

/**
 * Ответ сервера с метаданными приглашения: в зависимости от типа сущности
 * заполняются поля канала, трансляции или конференции.
 */
export interface InviteInfoData {

    /** Ссылка-приглашение (клиент дописывает её перед открытием формы). */
    invite?: string;

    /** Отображаемое имя сущности. */
    name?: string;

    /** Описание сущности. */
    about?: string;

    /** Тип сущности приглашения (channel/broadcast/meet/bot/user). */
    entity_type?: string;

    /** Ветка канала. */
    channel_id?: string;

    /** Тип канала (строка из БД: "channel"/"group"). */
    channel_type?: string;

    /** Отображаемое имя канала. */
    display_name?: string;

    /** Число участников канала. */
    total_members?: number;

    /** Ветка трансляции. */
    broadcast_id?: string;

    /** Ветка конференции. */
    meet_id?: string;

    /** Прочие поля сущности (формы приглашений читают их самостоятельно). */
    [key: string]: unknown;

}

/**
 * ***************************************************************************
 * Получить информацию о приглашении по ссылке.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу.
 * @param data - Данные запроса.
 * @returns Метаданные сущности приглашения.
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function getInviteInfoRequest(data: GetInviteInfoData): Promise<Answer<InviteInfoData>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT_HEAVY)
        .emitWithAck<InviteInfoData>("[invite]: get info", data);

}
