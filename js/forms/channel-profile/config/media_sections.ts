// Импортируем components
import { PhotoItem } from "../components/photo.js";
import { VideoItem } from "../components/video.js";
import { FileItem } from "../components/file.js";
import { AudioItem } from "../components/audio.js";
import { VoiceItem } from "../components/audio_note.js";
import { UrlItem } from "../components/url.js";

// Импортируем типы
import type { MediaSection } from "../types.js";

/**
 * ***************************************************************************
 * MEDIA_SECTIONS - описание вкладок профиля канала.
 *
 * Зачем конфиг: шесть вкладок порождали 30 файлов почти одинакового кода —
 * свой запрос, функцию пагинации, обработчик скролла, две подписки Store.
 * В сумме ~1350 строк, в которых различались единицы строк. Теперь вкладка
 * описывается одной записью здесь, а общая логика живёт в functions/events.
 *
 * Как добавить вкладку: дописать запись в массив. Больше ничего трогать не
 * нужно — index.ts, load_section и subscribe_section работают по этому
 * массиву.
 *
 * Состояние пагинации (первая страница загружена, флаги isLoading*,
 * hasMore*, границы курсора, блок пустого состояния, менеджер якоря)
 * НЕ перечисляется здесь: ключи выводятся из section.id (см.
 * functions/load_section.ts), чтобы запись вкладки описывала только её
 * природу, а не текущее состояние формы.
 * ***************************************************************************
 */
export const MEDIA_SECTIONS: MediaSection[] = [

    {
        id: "photos",
        storeKey: "photoStore",
        listKey: "listPhotos",
        scrollKey: "osListPhotosScrollInstance",
        event: "[channel-profile]: get photos",
        localeKey: "photos",
        layout: "grid",
        icon: "photo",
        component: PhotoItem
    },

    {
        id: "videos",
        storeKey: "videoStore",
        listKey: "listVideos",
        scrollKey: "osListVideosScrollInstance",
        event: "[channel-profile]: get videos",
        localeKey: "videos",
        layout: "grid",
        icon: "video",
        component: VideoItem
    },

    {
        id: "files",
        storeKey: "fileStore",
        listKey: "listFiles",
        scrollKey: "osListFilesScrollInstance",
        event: "[channel-profile]: get files",
        localeKey: "files",
        layout: "list",
        icon: "file",
        component: FileItem
    },

    {
        id: "urls",
        storeKey: "urlStore",
        listKey: "listUrls",
        scrollKey: "osListUrlsScrollInstance",
        event: "[channel-profile]: get urls",
        localeKey: "urls",
        layout: "list",
        icon: "link",
        component: UrlItem
    },

    {
        // id не совпадает с ключом локали и с именем события — исторически
        // вкладка голосовых называется audio-notes в DOM, voices в локали
        // и get voices в сокете. Правка id сломала бы deep-ссылки вида
        // ?channel-profile=<id>&tab=..., поэтому оставляем как есть
        id: "audio-notes",
        storeKey: "audioNoteStore",
        listKey: "listAudioNotes",
        scrollKey: "osListVoicesScrollInstance",
        event: "[channel-profile]: get voices",
        localeKey: "voices",
        layout: "list",
        icon: "microphone",
        component: VoiceItem
    },

    {
        id: "audios",
        storeKey: "audioStore",
        listKey: "listAudios",
        scrollKey: "osListAudiosScrollInstance",
        event: "[channel-profile]: get audios",
        localeKey: "audios",
        layout: "list",
        icon: "music",
        component: AudioItem
    }

];

/**
 * ***************************************************************************
 * Находит описание секции по её id.
 * @param id - Идентификатор вкладки.
 * @returns Описание секции или null.
 * ***************************************************************************
 */
export function getSection(id: string): MediaSection | null {
    return MEDIA_SECTIONS.find(section => section.id === id) || null;
}
