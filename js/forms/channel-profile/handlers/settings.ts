// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем forms
import { ChannelSettings } from "../../channel-settings/index.js";
import { GroupSettings } from "../../group-settings/index.js";
import { GroupTopicSettings } from "../../group-topic-settings/index.js";

// Импортируем типы
import type { ChannelProfile } from "../types.js";

/**
 * Конструктор формы настроек: все три формы принимают одинаковые данные.
 */
type SettingsFormCtor = new (data: { channelId: string }) => unknown;

/**
 * ***************************************************************************
 * SETTINGS_BY_TYPE - карта «тип канала → форма настроек».
 *
 * Всё, что не перечислено в карте, не делает ничего.
 *
 * Типы каналов: 1, 8 — диалоги, 2 — группа, 3 — канал, 4 — тема,
 * 5 — избранное, 6 — чат конференции, 7 — чат трансляции.
 * Типы 6 и 7 намеренно не сопоставлены форме: для них настроек пока нет,
 * и кнопка настроек у них и не показывается (см. `_update` в index.ts —
 * она скрывает кнопку для всех типов кроме 2, 3, 4).
 * ***************************************************************************
 */
const SETTINGS_BY_TYPE: Record<number, SettingsFormCtor> = {

    // Группа
    2: GroupSettings,

    // Канал
    3: ChannelSettings,

    // Топик группы
    4: GroupTopicSettings

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

        // Все формы настроек принимают одинаковые данные. Тип канала
        // появляется после загрузки профиля — без него открывать нечего
        const type = form?.profile?.type;
        if (type === undefined) return;

        const Settings = SETTINGS_BY_TYPE[type];
        if (!Settings) return;

        new Settings({ channelId: form.channelId });

    } catch (error) {

        Logger.error(error);

    }

}
