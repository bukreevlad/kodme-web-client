// Расширения изображений (для превью вынесены отдельно)
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"];

// Расширения видео
const VIDEO_EXTENSIONS = ["mp4", "mkv", "avi", "mov", "wmv", "flv", "webm", "m4v", "mpeg", "mpg", "3gp", "ts"];

// Расширения аудио
const AUDIO_EXTENSIONS = ["mp3", "wav", "ogg", "flac", "aac", "m4a", "wma", "opus", "mid", "midi", "amr"];

// Расширения архивов
const ARCHIVE_EXTENSIONS = ["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "iso", "tgz"];

// Расширения офисных документов
const WORD_EXTENSIONS = ["doc", "docx", "odt", "rtf"];
const EXCEL_EXTENSIONS = ["xls", "xlsx", "csv", "ods"];
const POWERPOINT_EXTENSIONS = ["ppt", "pptx", "odp"];

// Расширения скриптов и кода
const CODE_EXTENSIONS = ["js", "ts", "jsx", "tsx", "py", "java", "c", "cpp", "h", "hpp", "cs", "php", "rb", "go", "rs", "swift", "kt", "m", "sh", "bash", "zsh", "fish", "html", "htm", "css", "scss", "less", "json", "xml", "yml", "yaml", "sql", "vue", "svelte", "lua", "dart", "graphql", "ini", "toml", "bat", "ps1", "dockerfile", "makefile"];

// Расширения текстовых документов
const TEXT_EXTENSIONS = ["txt", "md", "log", "markdown", "rst", "text"];

/**
 * Данные файла для определения иконки.
 */
export interface FileIconData {

    /** Расширение файла. */
    extname?: string;

    /** Имя файла (расширение вычисляется из него, если extname нет). */
    file_name?: string;

}

/**
 * ***************************************************************************
 * Получение иконки файла по его типу (расширению).
 * @param data - Данные файла.
 * @returns Название иконки из набора Tabler.
 * ***************************************************************************
 */
export function getFileIcon(data: FileIconData = {}): string {

    // Получаем расширение файла
    let ext = (data.extname || "").toLowerCase().replace(/^\./, "");

    // Если расширения нет — пробуем вычислить из имени файла
    if (!ext && data.file_name) {
        let parts = data.file_name.split(".");
        ext = parts.length > 1 ? parts.pop()?.toLowerCase() || "" : "";
    }

    // Определяем иконку по типу файла
    switch (true) {
        case IMAGE_EXTENSIONS.includes(ext): return "photo";
        case VIDEO_EXTENSIONS.includes(ext): return "video";
        case AUDIO_EXTENSIONS.includes(ext): return "file-music";
        case ARCHIVE_EXTENSIONS.includes(ext): return "archive";
        case ext === "pdf": return "file-type-pdf";
        case WORD_EXTENSIONS.includes(ext): return "file-word";
        case EXCEL_EXTENSIONS.includes(ext): return "file-spreadsheet";
        case POWERPOINT_EXTENSIONS.includes(ext): return "file-type-ppt";
        case CODE_EXTENSIONS.includes(ext): return "file-code";
        case TEXT_EXTENSIONS.includes(ext): return "file-text";
        case ["db", "sqlite", "sqlite3", "mdb"].includes(ext): return "file-database";
        default: return "file";
    }

}
