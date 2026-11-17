// Импортируем типы
import type { AvatarImageDocument } from "../../components/avatars.js";

/**
 * Настройки канала, которые читает форма (ответ "[channel]: get settings").
 *
 * Полей объявлено ровно столько, сколько читает и пишет форма: серверная
 * строка шире, лишнее в тип не выносится, чтобы не врать о контракте.
 */
export interface ChannelSettingsRecord {

    /** Id канала. */
    id: string;

    /** Название. */
    name: string;

    /** Описание. */
    about?: string | null;

    /** Публичная ссылка. */
    link?: string | null;

    /** Канал публичный. */
    visibility?: "public" | "private";

    /** Кто может публиковать. */
    posting_mode?: "all" | "admins";

    /** Разрешено комментирование. */
    is_commenting?: boolean;

    /** Документ изображения аватара. */
    avatar?: AvatarImageDocument | null;

}
