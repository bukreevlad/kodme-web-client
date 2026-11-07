// Импортируем типы
import type { CastThumbnail } from "../broadcasts/types.js";

/**
 * Настройки трансляции, которые читает форма (ответ "[broadcast]: get settings"
 * — meta Broadcast + поле token).
 *
 * Полей объявлено ровно столько, сколько читает форма: серверная строка
 * шире, лишнее в тип не выносится, чтобы не врать о контракте.
 */
export interface BroadcastSettingsRecord {

    /** Название трансляции. */
    name: string;

    /** Описание трансляции. */
    about?: string | null;

    /** Публичная / приватная. */
    is_public?: boolean;

    /** Включён ли чат трансляции. */
    is_chat?: boolean;

    /** Токен подключения трансляции к серверу (rtmp/whip/chat-ссылки). */
    token: string;

    /** Документ обложки. */
    thumbnail?: CastThumbnail | null;

}
