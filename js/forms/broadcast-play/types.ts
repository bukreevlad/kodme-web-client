// Импортируем сторонние пакеты
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
 * stream_info_update). video.fps приходит из ответа сервера
 * (REST API OvenMediaEngine).
 */
export interface StreamInfo {

    /** Название потока. */
    name?: string;

    /** Приложение потока на медиасервере. */
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
        /** Кадров в секунду (из ответа сервера). */
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

    /**
     * Варианты качества WebRTC-воспроизведения (из OvenMediaEngine).
     * Заполняется только при просмотре через RTC — из них клиент строит
     * меню «Качество» в панели видеоплеера.
     */
    renditions?: StreamRendition[];

}

/**
 * Вариант качества в ответе "[broadcast]: get stream info".
 */
export interface StreamRendition {

    /** Имя рендеринга в OvenMediaEngine (source, 720p, 480p). */
    name: string;

    /** Ширина кадра. */
    width: number | null;

    /** Высота кадра. */
    height: number | null;

    /** Битрейт видеотрека (bps). */
    bitrate: number | null;

    /** Частота кадров. */
    frameRate: number | null;

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
    owner_id: string;

    /** Ведёт ли трансляцию бот. */
    is_bot: boolean | null;

    /** Id создателя бота-автора (null — автор не бот). */
    bot_owner_id: string | null;

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
 * Движок потока формы: hls.js (LL-HLS).
 *
 * kind дублирует form.typePlay — invariant: пока движок существует,
 * kind всегда равен текущему typePlay (start_* ставит тип до создания
 * движка, stop_* гасит движок при совпадении типа). kind нужен для
 * сужения union'а: у hls.js свои наборы методов.
 */
export type StreamEngine =
    | { kind: "hls"; player: Hls }
    | null;

/**
 * Имена чипов статистики: по ним же поля вешаются на форму
 * (см. functions/update_stats.ts).
 */
export type StatChipName = "watching" | "timing" | "resolution" | "fps" | "bitrate" | "incoming";
