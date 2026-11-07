// Импортируем сторонние пакеты
import type Mpegts from "mpegts.js";
import type Hls from "hls.js";

// Импортируем utils
import type { Thumbnail } from "../../utils/helpers/get_thumbnail_size_query.js";

/**
 * Обложка трансляции в ответе "[broadcast]: open" (payload документа
 * storage с токеном доступа).
 */
export interface CastThumbnail {

    /** Id документа обложки. */
    id: string;

    /** Токен доступа к документу. */
    token: string;

    /** Метаданные документа (клиент читает только варианты обложки). */
    metadata?: {
        /** Доступные размеры обложки. */
        thumbnails?: Thumbnail[];
    } | null;

}

/**
 * Данные потока из "[broadcast]: get stream info".
 *
 * Поля — только те, что реально читает форма (чипы статистики и
 * stream_info_update). video.fps приходит из ответа сервера (SRS);
 * RTC-путь дополнительно перезаписывает fps из getStats() браузера
 * (см. functions/rtc_stats.ts).
 */
export interface StreamInfo {

    /** Название потока. */
    name?: string;

    /** Приложение потока на SRS. */
    app?: string;

    /** Идёт ли поток прямо сейчас. */
    online: boolean;

    /** Битрейт потока. */
    bitrate?: {
        /** Битрейт в мегабитах в секунду. */
        mbps?: number;
    };

    /** Суммарно получено байт. */
    received_total?: number;

    /** Параметры видео потока. */
    video?: {
        /** Кодек видео. */
        codec?: string | null;
        /** Ширина кадра. */
        width?: number | null;
        /** Высота кадра. */
        height?: number | null;
        /** Кадров в секунду (из SRS; RTC-путь обновляет из getStats). */
        fps?: number | null;
    };

    /** Параметры аудио потока. */
    audio?: {
        /** Кодек аудио. */
        codec?: string | null;
    };

    /** Сколько зрителей смотрит сейчас. */
    readers?: number;

    /** Сколько соединений было суммарно. */
    total_readers?: number;

}

/**
 * Трансляция — полезная нагрузка ответа "[broadcast]: open".
 *
 * Поля — только те, что реально читает форма (шапка, чат, меню, обложка,
 * таймер, периодический опрос потока).
 */
export interface BroadcastCast {

    /** Id трансляции (UUID v7). */
    id: string;

    /** Название трансляции. */
    name: string;

    /** Описание трансляции (null — пусто). */
    about: string | null;

    /** Открыт ли чат трансляции. */
    is_chat: boolean;

    /** Id канала чата трансляции (null — чата нет). */
    chat_channel_id: string | null;

    /** Id автора трансляции. */
    created_user_id: string;

    /** Ведёт ли трансляцию бот. */
    is_bot: boolean | null;

    /** Id создателя бота-автора (null — автор не бот). */
    bot_created_user_id: string | null;

    /** Отображаемое имя автора (имя+фамилия либо ссылка бота). */
    created_display_name: string | null;

    /** Обложка трансляции (есть не у всех). */
    thumbnail?: CastThumbnail | null;

    /** Идёт ли эфир (приходит из "[broadcast]: open", дальше не меняется). */
    is_live: boolean;

    /** Время старта эфира (ISO-строка; есть только при живом эфире). */
    started_at?: string | null;

    /** Токен просмотра трансляции (входит в ссылки потоков). */
    access_token: string;

    /** Данные потока (обновляется периодическим опросом). */
    stream?: StreamInfo | null;

}

/**
 * Движок потока формы: mpegts.js (FLV) либо hls.js (HLS).
 *
 * kind дублирует form.typePlay — invariant: пока движок существует,
 * kind всегда равен текущему typePlay (start_* ставит тип до создания
 * движка, stop_* гасит движок при совпадении типа). kind нужен для
 * сужения union'а: у mpegts и hls.js разные наборы методов.
 */
export type StreamEngine =
    | { kind: "flv"; player: Mpegts.Player }
    | { kind: "hls"; player: Hls }
    | null;

/**
 * Имена чипов статистики: по ним же поля вешаются на форму
 * (см. functions/update_stats.ts).
 */
export type StatChipName = "watching" | "timing" | "resolution" | "fps" | "bitrate" | "incoming";
