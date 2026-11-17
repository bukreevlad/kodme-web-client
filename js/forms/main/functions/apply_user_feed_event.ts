// Импортируем utils

// Импортируем forms
import { FormsRegistry } from "../../../core/managers/forms_registry.js";
import { Main } from "../index.js";

// Импортируем functions
import { getUserUpdates } from "./get_user_updates.js";

// Импортируем events (апплайеры событий к локальным хранилищам и UI)
import { applyChannelNew } from "../events/socket/channels/new.js";
import { applyChannelRemove } from "../events/socket/channels/remove.js";

// Импортируем requests
import { getChannelInfoRequest } from "../../channel-profile/requests/get_channel_info.js";

// Импортируем db
import { getUserFeedUpts, setUserFeedUpts } from "../db.js";

// Импортируем типы
import { UserFeedEvent } from "../../../types/domain.js";

/**
 * ***************************************************************************
 * Применить событие личной ленты пользователя к локальным хранилищам и UI.
 *
 * Единая точка применения для живого толчка `[user]: feed` и догонки
 * `[user]: get updates`: событие несёт id канала, данные канала
 * дозапрашиваются (свежими на момент применения). Правила upid: дубль
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

    // Канал события: payload несёт его id
    const channelId = channel_id(event);
    if (!channelId) return;

    switch (event.type) {

        // Канал появился у пользователя: данные дозапрашиваем свежими
        case "channel_created": {
            const response = await getChannelInfoRequest({ channel_id: channelId });
            if (response.status && response.data) await applyChannelNew(response.data);
            return;
        }

        // Канал исчез у пользователя — убираем его из хранилищ
        case "channel_removed": {
            await applyChannelRemove({ channel_id: channelId });
            return;
        }

    }

}

/**
 * ***************************************************************************
 * Извлечь id канала из payload события.
 * @param event - Событие личной ленты.
 * @returns Id канала либо пустая строка.
 * ***************************************************************************
 */
function channel_id(event: UserFeedEvent): string {

    const value = event.payload.channel_id;
    return typeof value === "string" && value ? value : "";

}
