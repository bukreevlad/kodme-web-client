// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { LocalStorage } from "../../../utils/local_storage.js";
import { isChannelUnavailable } from "../../../utils/helpers/channel_unavailable.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";

// Импортируем forms
import { FormsRegistry } from "../../../core/managers/forms_registry.js";
import { Main } from "../index.js";

// Импортируем functions
import { getUserUpdates } from "./get_user_updates.js";
import { getSessionMainFolders } from "./session_identity.js";
import { addFolderTab } from "./add_folder_tab.js";
import { removeFolderTab } from "./remove_folder_tab.js";
import { addChannelToFolderPane, removeChannelFromFolderPane } from "./folder_pane.js";
import { updateFolderUnread } from "./update_folder_unread.js";

// Импортируем events (апплайеры событий к локальным хранилищам и UI)
import { applyChannelNew } from "../events/socket/channels/new.js";
import { applyChannelUpdate } from "../events/socket/channels/update.js";
import { applyChannelRemove } from "../events/socket/channels/remove.js";

// Импортируем requests
import { getChannelInfoRequest } from "../../channel-profile/requests/get_channel_info.js";
import { getUserInfoRequest } from "../../user-profile/requests/get_user_info.js";

// Импортируем db
import { channelsTable, getUserFeedUpts, setUserFeedUpts } from "../db.js";

// Импортируем типы
import { UserFeedEvent } from "../../../types/domain.js";
import { isRecord } from "../types.js";
import type { AvatarImageDocument } from "../../../components/avatars.js";
import type { SessionProfile } from "../../menu/types.js";
import type { UserProfile } from "../../user-profile/index.js";
import type { UserProfileRecord } from "../../user-profile/types.js";
import type { UserSettings } from "../../user-settings/index.js";
import type { ChannelRecord, MainFolder } from "../types.js";

/**
 * ***************************************************************************
 * Применить событие личной ленты пользователя к локальным хранилищам и UI.
 *
 * Единая точка применения для живого толчка `[user]: feed` и догонки
 * `[user]: get updates`: событие несёт id канала либо пользователя —
 * данные дозапрашиваются свежими на момент применения. Правила upid: дубль
 * (upid не новее последнего применённого) пропускается, пропуск в ленте у
 * живого события уводит в догонку, финальный upid фиксируется в мета.
 * @param event - Событие личной ленты.
 * @param live - Событие пришло живым толчком (а не догонкой).
 * ***************************************************************************
 */
export async function applyUserFeedEvent(event: UserFeedEvent, live: boolean): Promise<void> {

    // Правила upid: дубль — событие уже применено
    const lastUpts = await getUserFeedUpts();
    if (event.upid <= lastUpts) return;

    // Пропуск в ленте: живое событие догоняется целиком — догонка
    // вернёт недостающие события тем же порядком
    if (event.upid > lastUpts + 1) {
        const main = FormsRegistry.getOwner<Main>("main");

        if (live && main) await getUserUpdates(main);
        if (live) return;
    }

    // Применяем событие по его типу
    await dispatch(event);

    // Фиксируем точку личной ленты
    await setUserFeedUpts(event.upid);

}

/**
 * ***************************************************************************
 * Раздать событие аплайеру по типу.
 * @param event - Событие личной ленты.
 * ***************************************************************************
 */
async function dispatch(event: UserFeedEvent): Promise<void> {

    switch (event.type) {

        // Смена профиля: payload несёт id пользователя и изменённое поле
        case "user_updated": {
            await applyUserUpdated(event);
            return;
        }

        // Папка создана: имя идёт в payload — сессия и вкладка без запроса
        case "folder_created": {
            const folderId = payloadString(event, "folder_id");
            const name = payloadString(event, "name");
            if (!folderId || !name) return;
            const folder: MainFolder = { id: folderId, name };
            addFolderToSession(folder);
            const main = FormsRegistry.getOwner<Main>("main");
            if (main) addFolderTab(main, folder);
            return;
        }

        // Папка удалена
        case "folder_removed": {
            const folderId = payloadString(event, "folder_id");
            if (!folderId) return;
            removeFolderFromSession(folderId);
            const main = FormsRegistry.getOwner<Main>("main");
            if (main) removeFolderTab(main, folderId);
            return;
        }

        // Принадлежность канала к папке: направление задаёт тип события
        case "channel_moved_to_folder":
        case "channel_removed_from_folder": {
            const channelId = payloadString(event, "channel_id");
            const folderId = payloadString(event, "folder_id");
            if (!channelId || !folderId) return;
            await applyFolderMembership(channelId, folderId, event.type === "channel_moved_to_folder");
            return;
        }

        // Канал появился у пользователя: данные дозапрашиваем свежими
        case "channel_created": {
            const channelId = payloadString(event, "channel_id");
            if (!channelId) return;
            try {

                const response = await getChannelInfoRequest({ channel_id: channelId });
                if (response.status && response.data) await applyChannelNew(response.data);

            } catch (error) {

                // Канал недоступен (прав нет, удалён, заблокирован): событие
                // пропускается — иначе оно навсегда стопорит догонку. Устаревшая
                // локальная копия вычищается (зеркало refreshChannelSnapshot)
                if (isChannelUnavailable(error)) {
                    Logger.warn(`[app][user-feed]: канал ${channelId} недоступен — событие пропущено`);
                    await applyChannelRemove({ channel_id: channelId });
                    return;
                }

                // Временная ошибка (сеть/таймаут): пробрасываем — upid не
                // зафиксируется и событие повторится
                throw error;

            }
            return;
        }

        // Канал исчез у пользователя — убираем его из хранилищ
        case "channel_removed": {
            const channelId = payloadString(event, "channel_id");
            if (!channelId) return;
            await applyChannelRemove({ channel_id: channelId });
            return;
        }

    }

}

/**
 * ***************************************************************************
 * Применить событие смены профиля: обновить аватар пользователя — в открытом
 * профиле, в себе (сессия и форма настроек) и в чужих списках (строки
 * диалогов).
 * @param event - Событие личной ленты (user_updated).
 * ***************************************************************************
 */
async function applyUserUpdated(event: UserFeedEvent): Promise<void> {

    // Обновляется аватар: другим полям профиля событие пока не умеет
    const userId = payloadString(event, "user_id");
    const field = payloadString(event, "field");
    if (!userId || field !== "avatar") return;

    // Профиль свежими на момент применения — источник аватара для открытого
    // профиля и сессии; недоступный профиль не должен стопорить догонку
    const profile = await fetchProfile(userId);

    // Открытый профиль пользователя: обновляем привязанный аватар
    const profileForm = FormsRegistry.getOwner<UserProfile>(`user-profile:${userId}`);
    if (profileForm && profile) profileForm.avatar?.setImage(profile.avatar ?? null);

    // Свой профиль: свежий аватар уходит в сессию и открытые настройки
    if (userId === ownUserId()) {
        if (profile) applyOwnAvatar(profile.avatar ?? null);
        return;
    }

    // Чужой аватар: строки диалогов показывают аватар из профиля
    // собеседника — перечитываем эти диалоги
    await refreshDialogsAvatar(userId);

}

/**
 * ***************************************************************************
 * Получить профиль пользователя для события смены аватара.
 *
 * Профиль, недоступный по постоянной причине (пользователь удалён или скрыт),
 * даёт null — событие пропускается и курсор двигается дальше. Временная
 * ошибка (сеть/таймаут) пробрасывается: upid не зафиксируется, событие
 * повторится при следующей синхронизации.
 * @param userId - Id пользователя.
 * @returns Профиль либо null, если профиль недоступен.
 * ***************************************************************************
 */
async function fetchProfile(userId: string): Promise<UserProfileRecord | null> {

    try {

        const response = await getUserInfoRequest({ user_id: userId });
        return response.status ? response.data ?? null : null;

    } catch (error) {

        if (getErrorMessage(error).includes("CANT_GET_USER_DATA")) {
            Logger.warn(`[app][user-feed]: профиль ${userId} недоступен — событие пропущено`);
            return null;
        }
        throw error;

    }

}

/**
 * ***************************************************************************
 * Добавить папку в список папок сессии (повтор события — no-op).
 * @param folder - Данные папки.
 * ***************************************************************************
 */
function addFolderToSession(folder: MainFolder): void {

    // Сессия: поле user — unknown на границе localStorage
    const user: unknown = LocalStorage.session?.user;
    if (!isRecord(user)) return;
    const folders = getSessionMainFolders();
    if (folders.some(item => item.id === folder.id)) return;
    user.main_folders = [...folders, folder];
    LocalStorage.updateSession(LocalStorage.session);

}

/**
 * ***************************************************************************
 * Убрать папку из списка папок сессии (повтор события — no-op).
 * @param folderId - Id папки.
 * ***************************************************************************
 */
function removeFolderFromSession(folderId: string): void {

    // Сессия: поле user — unknown на границе localStorage
    const user: unknown = LocalStorage.session?.user;
    if (!isRecord(user)) return;
    const folders = getSessionMainFolders();
    if (!folders.some(item => item.id === folderId)) return;
    user.main_folders = folders.filter(item => item.id !== folderId);
    LocalStorage.updateSession(LocalStorage.session);

}

/**
 * ***************************************************************************
 * Применить принадлежность канала к папке: запись канала патчится в сторе
 * и IndexedDB, строка переносится между панелями папок, обновляются бейджи.
 * @param channelId - Id канала.
 * @param folderId - Id папки.
 * @param isMoved - true — канал в папке, false — убран из неё.
 * ***************************************************************************
 */
async function applyFolderMembership(channelId: string, folderId: string, isMoved: boolean): Promise<void> {

    // Главная форма и данные канала: стор первично, IndexedDB — запасной путь
    const main = FormsRegistry.getOwner<Main>("main");
    const channel = main?.store.get(channelId) ?? await channelsTable().get(channelId);
    if (!channel) return;

    // Новый состав папок канала (повтор события — no-op)
    const current = channel.main_folders_ids ?? [];
    const next = isMoved
        ? (current.includes(folderId) ? current : [...current, folderId])
        : current.filter(id => id !== folderId);

    // Стор: строка списка перерисуется подпиской item::updated
    const updated: ChannelRecord = { ...channel, main_folders_ids: next };
    if (main?.store.get(channelId)) main.store.update(channelId, updated);

    // IndexedDB
    await channelsTable().update(channelId, { main_folders_ids: next });

    // Строка канала в панели папки (защита от дублей внутри функций)
    if (isMoved) addChannelToFolderPane(folderId, updated);
    else removeChannelFromFolderPane(folderId, updated);

    // Бейджи непрочитанных на вкладках папок
    if (main) updateFolderUnread(main);

}

/**
 * ***************************************************************************
 * Id текущего пользователя из сессии.
 * @returns Id пользователя либо пустая строка (сессии нет).
 * ***************************************************************************
 */
function ownUserId(): string {

    // invariant: профиль сессии приходит с сервера в фиксированном виде
    // { id, display_name, ... } — читаем поле этим сужением unknown
    const user = LocalStorage.session?.user as SessionProfile | undefined;
    return user?.id ?? "";

}

/**
 * ***************************************************************************
 * Применить свежий аватар текущего пользователя: документ уходит в сессию
 * (настройки и меню читают её при открытии), открытая форма настроек
 * перерисовывается.
 * @param avatar - Документ аватара (null — аватар снят).
 * ***************************************************************************
 */
function applyOwnAvatar(avatar: AvatarImageDocument | null): void {

    // Сессия: поле user — unknown на границе localStorage
    const session = LocalStorage.session;
    if (session) {
        (session.user as Record<string, unknown>).avatar = avatar;
        LocalStorage.updateSession(session);
    }

    // Открытая форма настроек: null снимает картинку (акроним с фоном)
    const settings = FormsRegistry.getOwner<UserSettings>("user-settings");
    settings?.avatar?.setImage(avatar);

}

/**
 * ***************************************************************************
 * Обновить аватар собеседника в списке каналов: каждый локальный диалог
 * с этим пользователем перечитывается и мержится в хранилища — строки
 * перерисовывают аватар, открытая форма сообщений обновляет шапку.
 * @param userId - Id пользователя.
 * ***************************************************************************
 */
async function refreshDialogsAvatar(userId: string): Promise<void> {

    // Диалоги с этим пользователем: аватар строки хранится из профиля собеседника
    const dialogs = await channelsTable().where("display_user_id").equals(userId).toArray();

    // Проходим по диалогам
    for (const dialog of dialogs) {

        try {

            // Данные диалога свежими на момент применения
            const response = await getChannelInfoRequest({ channel_id: dialog.id });
            if (response.status && response.data) await applyChannelUpdate(response.data);

        } catch (error) {

            // Диалог исчез на сервере — ленивая чистка строки; остальные
            // ошибки пробрасываются: upid не зафиксируется, событие повторится
            if (isChannelUnavailable(error)) {
                await applyChannelRemove({ channel_id: dialog.id });
            } else {
                throw error;
            }

        }

    }

}

/**
 * ***************************************************************************
 * Извлечь строковое поле из payload события (мусор отбрасываем).
 * @param event - Событие личной ленты.
 * @param name - Имя поля.
 * @returns Строковое значение либо пустая строка.
 * ***************************************************************************
 */
function payloadString(event: UserFeedEvent, name: string): string {

    const value = event.payload[name];
    return typeof value === "string" && value ? value : "";

}
