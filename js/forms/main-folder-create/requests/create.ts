// Импортируем config
import { Socket } from "../../../config/socket.js";
import { SOCKET_REQUEST_TIMEOUT } from "../../../config/constants.js";

// Импортируем типы
import type { Answer } from "../../../types/domain.js";
import type { MainFoldersManagerFolder } from "../../main-folders-manager/types.js";

/**
 * Данные запроса создания папки главного экрана.
 */
export interface CreateMainFolderRequestData {

    /** Название папки. */
    name: string;

}

/**
 * ***************************************************************************
 * Запрос создания папки главного экрана.
 *
 * Модуль запроса только отправляет запрос и пробрасывает ошибку наружу:
 * разбирает её вызывающий код (см. handlers/create.ts).
 * @param data - Данные запроса.
 * @returns Ответ сервера: созданная папка в конверте (сразу в типе записи
 *   стора менеджера папок — туда она и встаёт после создания).
 * @throws Ошибка сокета/таймаута пробрасывается без изменений.
 * ***************************************************************************
 */
export async function createMainFolderRequest(data: CreateMainFolderRequestData): Promise<Answer<MainFoldersManagerFolder>> {

    return await Socket.client.timeout(SOCKET_REQUEST_TIMEOUT)
        .emitWithAck<MainFoldersManagerFolder>("[main]: create folder", data);

}
