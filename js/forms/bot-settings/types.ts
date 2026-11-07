// Импортируем utils
import type { StoreItem } from "../../utils/store.js";

// Импортируем components
import type { AvatarImageDocument } from "../../components/avatars.js";

/**
 * Запись меню бота (команда либо категория-папка) из `bot_commands`
 * ответа `[bot]: get settings`.
 *
 * Поля — только те, что реально читает код формы: дерево меню, строки
 * списка и диалоги редактирования.
 */
export interface BotMenuRecord {

    /** Id записи (клиент генерирует UUID при добавлении). */
    id: string;

    /** Id родительской категории (null/отсутствие — корень меню). */
    categoryId?: string | null;

    /** Название записи. */
    name?: string;

    /** Описание записи. */
    about?: string;

    /** Текст команды (наличие отличает команду от категории). */
    command?: string;

    /** Отображённые копии элемента списка меню. */
    __domElements__?: HTMLElement[];

}

/**
 * Узел построенного дерева меню: запись плюс дочерние узлы.
 */
export interface BotMenuNode extends BotMenuRecord {

    /** Дочерние узлы (команды и вложенные категории). */
    children: BotMenuNode[];

}

/**
 * Элемент хлебной крошки пути: категория из дерева либо корень «./Меню»
 * (корень — не запись меню, а отдельный узел только с названием).
 */
export interface BotPathCrumb {

    /** Название крошки. */
    name?: string;

    /** Отображённые копии элемента крошки. */
    __domElements__?: HTMLElement[];

}

/**
 * Приложение бота в ответе `[bot]: get settings` (строка списка приложений).
 */
export interface BotAppRecord extends StoreItem {

    /** Id приложения. */
    id: string;

    /** Название приложения. */
    name: string;

    /** URL адрес приложения. */
    url: string;

    /** Короткая ссылка приложения. */
    link: string | null;

    /** Описание приложения. */
    about: string | null;

    /** Отображённые копии строки приложения. */
    __domElements__?: HTMLElement[];

}

/**
 * Черновик новой категории из диалога добавления папки.
 */
export interface BotCategoryDraft {

    /** Название папки. */
    name: string;

    /** Описание папки. */
    about: string;

}

/**
 * Черновик новой команды из диалога добавления команды.
 */
export interface BotCommandDraft {

    /** Текст команды. */
    command: string;

    /** Название команды. */
    name: string;

    /** Описание команды. */
    about: string;

}

/**
 * Результат диалога редактирования папки: правка полей либо удаление.
 */
export type BotCategoryEditResult =

    /** Правка названия и описания папки. */
    | { type: "edit"; name: string; about: string; }

    /** Удаление папки. */
    | { type: "remove" };

/**
 * Результат диалога редактирования команды: правка полей либо удаление.
 */
export type BotCommandEditResult =

    /** Правка команды, названия и описания. */
    | { type: "edit"; command: string; name: string; about: string; }

    /** Удаление команды. */
    | { type: "remove" };

/**
 * Данные бота в ответе `[bot]: get settings` (данные `[bot]: get info`
 * плюс `bot_commands`, `apps` и `bot_token`).
 */
export interface BotSettingsProfile {

    /** Id бота. */
    id: string;

    /** Описание бота. */
    bio: string | null;

    /** Владелец бота. */
    bot_created_user_id: string;

    /** Публичное имя бота (left join — бот может быть без ссылки). */
    link: string | null;

    /** Секретный токен бота. */
    bot_token: string | null;

    /** Аватар бота (документ с токеном; null — аватара нет). */
    avatar?: AvatarImageDocument | null;

    /** Команды и категории меню бота. */
    bot_commands: BotMenuRecord[];

    /** Приложения бота. */
    apps: BotAppRecord[];

}

/**
 * ***************************************************************************
 * Сужение payload'а стора до приложения бота.
 *
 * Данные приходят из хранилища формы, но тип события стора — unknown,
 * поэтому сверяемся guard'ом, а не приведением типов.
 * @param payload - Полезная нагрузка события стора.
 * @returns true, если это приложение с id-строкой.
 ***************************************************************************
 */
export function isBotAppRecord(payload: unknown): payload is BotAppRecord {
    return typeof payload === "object" &&
        payload !== null &&
        "id" in payload &&
        typeof payload.id === "string";
}
