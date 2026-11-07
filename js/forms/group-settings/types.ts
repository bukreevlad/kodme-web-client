// Импортируем типы
import type { AvatarImageDocument } from "../../components/avatars.js";

/**
 * Настройки группы, которые читает форма (ответ "[group]: get settings").
 *
 * Полей объявлено ровно столько, сколько читает и пишет форма: серверная
 * строка шире, лишнее в тип не выносится, чтобы не врать о контракте.
 */
export interface GroupSettingsRecord {

    /** Id группы. */
    id: string;

    /** Название. */
    name: string;

    /** Описание. */
    about?: string | null;

    /** Публичная ссылка. */
    link?: string | null;

    /** Группа публичная. */
    is_public?: boolean;

    /** Кто может публиковать. */
    is_posting?: boolean;

    /** Документ изображения аватара. */
    avatar?: AvatarImageDocument | null;

}
