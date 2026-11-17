// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем forms
import { ChannelSettings } from "../../channel-settings/index.js";
import { GroupSettings } from "../../group-settings/index.js";
import { GroupTopicSettings } from "../../group-topic-settings/index.js";

// Импортируем типы
import type { ChannelKind } from "../../../types/domain.js";
import type { ChannelProfile } from "../types.js";

/**
 * Конструктор формы настроек: все три формы принимают одинаковые данные.
 */
type SettingsFormCtor = new (data: { channelId: string }) => unknown;

/**
 * ***************************************************************************
 * SETTINGS_BY_KIND - карта «вид канала → форма настроек».
 *
 * Всё, что не перечислено в карте, не делает ничего.
 *
 * Виды каналов: dialog, group, channel, topic, favorite, meet_chat, cast_chat.
 * Чаты конференций и трансляций намеренно не сопоставлены форме: для них
 * настроек пока нет, и кнопка настроек у них и не показывается (см. `_update`
 * в index.ts — она скрывает кнопку для всех видов кроме group, channel, topic).
 * ***************************************************************************
 */
const SETTINGS_BY_KIND: Partial<Record<ChannelKind, SettingsFormCtor>> = {

    // Группа
    "group": GroupSettings,

    // Канал
    "channel": ChannelSettings,

    // Топик группы
    "topic": GroupTopicSettings

};

/**
 * ***************************************************************************
 * Открывает форму настроек по типу канала.
 * @param form - Форма профиля канала.
 * @returns void
 * ***************************************************************************
 */
export async function settingsHandler(form: ChannelProfile): Promise<void> {

    try {

        // Все формы настроек принимают одинаковые данные. Вид канала
        // появляется после загрузки профиля — без него открывать нечего
        const kind = form?.profile?.kind;
        if (kind === undefined) return;

        const Settings = SETTINGS_BY_KIND[kind];
        if (!Settings) return;

        new Settings({ channelId: form.channelId });

    } catch (error) {

        Logger.error(error);

    }

}
