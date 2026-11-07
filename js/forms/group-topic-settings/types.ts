// Импортируем типы
import type { AvatarImageDocument } from "../../components/avatars.js";

/**
 * Настройки темы группы, которые читает форма (ответ "[group-topic]: get settings").
 *
 * Полей объявлено ровно столько, сколько читает и пишет форма.
 */
export interface GroupTopicSettingsRecord {

    /** Id темы. */
    id: string;

    /** Название. */
    name: string;

    /** Описание. */
    about?: string | null;

    /** Тема публичная. */
    is_public?: boolean;

    /** Кто может публиковать. */
    is_posting?: boolean;

    /** Документ изображения аватара. */
    avatar?: AvatarImageDocument | null;

}
