// ***************************************************************************
// Минимальные типы для jsmediatags — только используемая часть API
// (чтение ID3/Vorbis-тегов: read + onSuccess/onError c полем tags.picture).
// ***************************************************************************

/** Бинарные данные вложенной обложки. */
interface JsMediaTagsPicture {
    /** MIME-тип или расширение ("image/jpeg" либо "JPG"). */
    format?: string;
    /** Данные обложки. */
    data?: number[] | Uint8Array;
}

/** Прочитанные теги аудиофайла. */
interface JsMediaTagsTags {
    album?: string;
    genre?: string;
    title?: string;
    artist?: string;
    picture?: JsMediaTagsPicture;
    [key: string]: unknown;
}

/** Результат успешного чтения тегов. */
interface JsMediaTagsReadResult {
    tags?: JsMediaTagsTags;
}

/** Опции чтения тегов. */
interface JsMediaTagsReadOptions {
    onSuccess?: (tag: JsMediaTagsReadResult) => void;
    onError?: (error: unknown) => void;
}

declare module "jsmediatags" {
    /** Точка входа библиотеки: чтение тегов файла. */
    const jsmediatags: {
        read(file: Blob | File, options: JsMediaTagsReadOptions): void;
    };

    export = jsmediatags;
}
