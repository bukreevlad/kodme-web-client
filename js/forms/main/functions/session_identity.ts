// Импортируем utils
import { LocalStorage } from "../../../utils/local_storage.js";

// Импортируем components (только типы)
import type { AvatarImageDocument } from "../../../components/avatars.js";

// Импортируем типы
import { isRecord } from "../types.js";
import type { MainFolder } from "../types.js";

/**
 * ***************************************************************************
 * SESSION_IDENTITY - чтение данных текущей сессии с проверкой структуры.
 *
 * Данные сессии лежат в localStorage и типизируются как `unknown`:
 * каждое обращение проходит через guard, а не через приведение типов.
 * ***************************************************************************
 */

/**
 * Id текущего пользователя из сессии.
 * @returns Id пользователя либо null (сессия неполная).
 */
export function getSessionUserId(): string | null {

    const user: unknown = LocalStorage.session?.user;
    if (!isRecord(user)) return null;

    return typeof user.id === "string" ? user.id : null;

}

/**
 * Отображаемое имя текущего пользователя из сессии.
 * @returns Отображаемое имя либо пустая строка (данных ещё нет).
 */
export function getSessionUserDisplayName(): string {

    const user: unknown = LocalStorage.session?.user;
    if (!isRecord(user)) return "";

    return typeof user.display_name === "string" ? user.display_name : "";

}

/**
 * Аватар текущего пользователя из сессии (документ файла либо null).
 * @returns Аватар пользователя либо null (данных ещё нет).
 */
export function getSessionUserAvatar(): AvatarImageDocument | null {

    const user: unknown = LocalStorage.session?.user;
    if (!isRecord(user)) return null;

    const avatar: unknown = user.avatar;
    if (!isRecord(avatar)) return null;

    // invariant: аватар из сессии — документ файла (id/token/metadata)
    return avatar as AvatarImageDocument;

}

/**
 * Название организации из сессии (заголовок главной формы и статус).
 * @returns Название организации либо пустая строка (данных ещё нет).
 */
export function getSessionOrganisationName(): string {

    const session: unknown = LocalStorage.session;
    if (!isRecord(session)) return "";

    const server: unknown = session.server;
    if (!isRecord(server)) return "";

    const organisation: unknown = server.organisation;
    if (!isRecord(organisation)) return "";

    return typeof organisation.name === "string" ? organisation.name : "";

}

/**
 * Папки пользователя из сессии (без общей папки «Все»).
 * @returns Массив папок; непохожие записи отбрасываются.
 */
export function getSessionMainFolders(): MainFolder[] {

    const user: unknown = LocalStorage.session?.user;
    if (!isRecord(user)) return [];

    const folders: unknown = user.main_folders;
    if (!Array.isArray(folders)) return [];

    return folders.filter(isMainFolder);

}

/**
 * Значение — папка главного экрана (id и название строками).
 * @param value - Проверяемое значение.
 * @returns true, если значение похоже на папку.
 */
function isMainFolder(value: unknown): value is MainFolder {
    return isRecord(value) && typeof value.id === "string" && typeof value.name === "string";
}
