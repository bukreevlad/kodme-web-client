// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { CacheManager } from "../../../utils/cache_manager.js";
import { applyAspectRatio } from "../../../utils/media/apply_aspect_ratio.js";
import { applyDurationLabel } from "../../../utils/media/apply_duration_label.js";
import { getThumbnailSizeQuery } from "../../../utils/helpers/get_thumbnail_size_query.js";
import * as StorageUrl from "../../../utils/network/storage_url.js";
import { FileRenditions } from "../../../utils/video/file_renditions.js";

// Импортируем components
import { ProgressIndicator } from "../../../components/progress.js";
import { VideoPlayer } from "../../../components/video_player.js";

// Импортируем типы
import type { FileRenditionOption } from "../../../utils/video/file_renditions.js";
import { getErrorMessage } from "../../../utils/helpers/error_util.js";
import type { AttachmentData } from "./types.js";

/**
 * ***************************************************************************
 * createVideoNoteItem - видео-кружок: превью с заглушкой, длительность,
 * пропорции 1/1 и ленивый запуск плеера по клику (со всеми рендерациями).
 *
 * Легаси-класс возвращал DOM-узел из конструктора, поэтому состояние плеера
 * живёт в замыкании фабрики. Родительское сообщение компоненту не нужно
 * (все данные читаются из вложения) — параметр убран.
 * @param data - Данные вложения (id, token, metadata и т.д.).
 * @returns DOM-элемент вложения.
 * ***************************************************************************
 */
export function createVideoNoteItem(data: AttachmentData): HTMLElement {

    // Актуальные данные вложения: __update__ может подменить объект
    let current = data;

    // Состояние плеера и превью
    let player: VideoPlayer | null = null;
    let srcThumbnail: string | null = null;
    let srcVideoFile: string | null = null;
    let thumbnailUrl: string | null = null;
    let progress: ProgressIndicator | null = null;

    // DOM-узлы: запрашиваются в setup, читаются в createPlayer/actions
    let placeholder: HTMLImageElement | null = null;
    let thumbnail: HTMLImageElement | null = null;
    let duration: HTMLElement | null = null;
    let playerWrap: HTMLElement | null = null;

    // ***************************************************************************
    // Шаблон элемента
    // ***************************************************************************
    function template(): HTMLElement {

        // invariant: корневой .item входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`
            <div class="item video-note flex flex-row relative w-full p-0 rounded-full cursor-pointer overflow-hidden">
                <div data-progress-wrap class="absolute w-full h-full z-4"></div>
                <div data-duration class="z-4 absolute py-[0.15rem] px-[0.45rem] rounded-xl pointer-events-none 
                                            top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 
                                            bg-[var(--color-black)]/50 text-sm text-[var(--color-white)]"></div>
                <div data-player class="hidden absolute inset-0 z-3"></div>
                <img data-thumbnail src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" class="object-cover w-full h-full z-2" draggable="false"/>
                <img data-placeholder src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" class="absolute object-cover w-full h-full z-1" draggable="false" />
            </div>
        `, "text/html").querySelector<HTMLElement>(".item")!;
    }

    // ***************************************************************************
    // Установка/Перерисовка данных
    // ***************************************************************************
    function setup(data: AttachmentData): void {

        try {

            // Записываем данные
            current = data;

            // Устанавливаем элементы
            placeholder = element.querySelector<HTMLImageElement>(":scope [data-placeholder]");
            thumbnail = element.querySelector<HTMLImageElement>(":scope [data-thumbnail]");
            playerWrap = element.querySelector<HTMLElement>(":scope [data-player]");
            progress = new ProgressIndicator({ width: "100%", strokeWidth: 1, radius: 20 });
            duration = element.querySelector<HTMLElement>(":scope [data-duration]");

            // Длительность. Показываем только когда она реально известна,
            // иначе бейдж скрывается, а не врёт «00:00». После запуска
            // плеера бейдж не трогаем — там поверх видео своя разметка.
            if (!player) {
                applyDurationLabel(duration, data?.metadata);
            }

            // Пропорции. Фолбэк 1/1 обязателен: в отличие от плитки
            // картинок, у .item.video-note в CSS нет aspect-ratio, поэтому без
            // известных размеров кружок схлопнется в полосу высотой 0.
            let width = data?.metadata?.original?.width || undefined;
            let height = data?.metadata?.original?.height || undefined;

            applyAspectRatio(
                [element, placeholder, thumbnail],
                width,
                height,
                [1, 1]
            );

            // Если есть placeholder у видео
            if (placeholder && data?.metadata?.placeholder) {
                placeholder.src = data.metadata.placeholder;
            }

            // Если есть thumbnails у видео и массив НЕ пустой
            if (data?.metadata?.thumbnails && data.metadata.thumbnails.length > 0) {

                // Получения размера миниатюры
                const thumbnails = data?.metadata?.thumbnails;
                const sizeQuery = getThumbnailSizeQuery(thumbnails, 400);
                const thumb = sizeQuery.thumb;

                // Если превью это File или Blob (загружается прямо сейчас на клиенте).
                // thumb === false означает «превью нет» — поля читаем только у миниатюры.
                if (thumb !== false && (thumb._file instanceof File || thumb._file instanceof Blob)) {
                    // invariant: у локальной миниатюры есть blob-ссылка _url
                    thumbnailUrl = thumb._url as string;
                } else {
                    // id есть у серверного файла; у локального берётся ветка
                    // выше — пустая строка здесь лишь закрывает тип (легаси
                    // строила битую ссылку с undefined в URL)
                    srcThumbnail = StorageUrl.forStorage(data.id ?? "", { size: thumb !== false ? thumb.width : undefined });

                    thumbnailUrl = CacheManager.getMediaSrc({
                        url: srcThumbnail,
                        file_token: data.token,
                        type: "image"
                    });

                }

                // Прячем размытую заглушку, когда превью загрузилось.
                // Раньше обработчик висел только в ветке серверной ссылки,
                // и для локального blob он не срабатывал вовсе.
                if (thumbnail) {
                    thumbnail.onload = () => {
                        placeholder?.classList.add("hidden");
                    };

                    thumbnail.src = thumbnailUrl;
                }

                // Постер живёт в нашем VideoPlayer (он умеет скрывать его после
                // первого play). Если плеер ещё не создан, URL сохранится в
                // thumbnailUrl и уйдёт в options.poster при первом клике.
                if (player) {
                    player.poster = thumbnailUrl;
                }

            }

            // Если видео это File или Blob
            if (data?._file instanceof File || data?._file instanceof Blob) {
                srcVideoFile = URL.createObjectURL(data._file);
            } else {

                // Добавляем type=video, чтобы SW сразу понимал, в какой кеш класть.
                // id есть у серверного файла — легаси строила бы битую ссылку
                // с undefined в URL
                srcVideoFile = StorageUrl.forStorage(data.id ?? "");

            }

        } catch (error) {
            Logger.error("Setup Error:", error);
        }

    }

    // ***************************************************************************
    // Создаем проигрыватель
    // ***************************************************************************
    async function createPlayer(): Promise<void> {

        // Повторный клик по превью после досмотра не должен плодить плееры
        if (player) return;

        // Прогресс создаётся в setup() — без него плеер не собрать
        if (!progress) return;

        // 1. Создаем и настраиваем компонент прогресса
        const progressElement = progress.getElement();

        // Добавляем прогресс
        const progressWrap = element.querySelector(":scope [data-progress-wrap]");
        progressWrap && progressWrap.appendChild(progressElement);

        // 2. Формируем базовый URL (ссылка формируется в setup() — без неё
        // плеер не собрать)
        if (!srcVideoFile) return;
        const isFile = current?._file instanceof File || current?._file instanceof Blob;
        const mediaUrl = isFile ? srcVideoFile : CacheManager.getMediaSrc({
            url: srcVideoFile,
            file_token: current.token,
            type: "video"
        });

        // 3. Поднимаем Video.js 10 в варианте «видеокружок»: собственный
        // скин с одной большой кнопкой play поверх квадратного кадра.
        // Нативный <video> создаёт сам компонент — он и будет общей точкой
        // для адаптера рендераций и для нашей шины событий.
        player = new VideoPlayer({
            insertInto: playerWrap,
            options: {
                variant: "note",
                autoplay: true,
                playsinline: true,
                poster: thumbnailUrl ?? undefined
            }
        });

        const video = player.video;

        // Подписки став один раз на весь жизненный цикл сообщения
        playerEvents();

        // 4. Источник и меню качества.
        //
        // Рендерации — целые MP4-файлы (360/720/1080), FileRenditions
        // переключает их сменой src, сохраняя позицию. Если рендераций нет
        // (крупный файл, старый документ, локальный blob) — играем оригинал.
        video.src = mediaUrl;

        const renditions = buildRenditions(isFile);

        if (renditions.length > 0) {
            const adapter = new FileRenditions({
                video: video,
                renditions: renditions,
                originalUrl: mediaUrl
            });

            player.attachRenditions(adapter);

            // Синхронизация ПОСЛЕ attach: Video.js узнаёт о списке качества
            // только когда `video.videoRenditions` уже стоит на элементе
            // (так же подключает адаптер конференция, см. render_tracks.js).
            adapter.sync();
        }

        // Показываем плеер вместо превью
        placeholder?.classList?.add("hidden");
        thumbnail?.classList?.add("hidden");
        duration?.classList?.add("hidden");
        playerWrap?.classList?.remove("hidden");

        // 5. Стартуем воспроизведение
        try {
            await player.play();
        } catch (error) {
            Logger.warn("[VideoNote] Автовоспроизведение заблокировано:", getErrorMessage(error) || error);
        }

    }

    // ***************************************************************************
    // Список рендераций для меню качества
    // ***************************************************************************
    function buildRenditions(isFile: boolean): FileRenditionOption[] {

        // Локальный blob — оригинал: рендерации считаются перед загрузкой,
        // но меню качества нужно только после ответа сервера с целями.
        const sources = current?.metadata?.renditions;
        if (isFile || !Array.isArray(sources) || sources.length === 0) return [];

        const list: FileRenditionOption[] = [];

        for (const rendition of sources) {

            if (!rendition?.label) continue;

            // Путь рендерации собираем не сами: сервер по `?rendition=<label>`
            // отдаёт `{папка}/q/<label>.mp4` (раздел 11 плана).
            // Рендерации есть только у серверного файла — id обязателен,
            // пустая строка лишь закрывает тип
            const url = CacheManager.getMediaSrc({
                url: StorageUrl.forStorage(current.id ?? "", { rendition: rendition.label }),
                file_token: current.token,
                type: "video"
            });

            list.push({
                label: rendition.label,
                width: rendition.width,
                url: url
            });

        }

        return list;

    }

    // ***************************************************************************
    // Прослушиватели проигрывателя
    // ***************************************************************************
    function playerEvents(): void {

        // Плеер создаётся перед вызовом — без него события не подписать
        const playerInstance = player;
        if (!playerInstance) return;

        // Событие при начале проигрывания
        playerInstance.on("play", () => {
            window.dispatchEvent(new CustomEvent("[app][audio]::media-play", {
                detail: {
                    type: "video",
                    id: current.id
                }
            }));

            // Переводим в состояние ожидания/обработки
            element.classList.add("is-play");
            progress && progress.update(0);
            progress && progress.show();

        });

        // Отслеживание прогресса
        playerInstance.on("timeupdate", () => {
            const currentTime = playerInstance.currentTime;
            const duration = playerInstance.duration;
            if (!duration) return;

            const progressPercent = (currentTime / duration) * 100;

            // Обновляем ваш компонент прогресса
            if (progress) {
                progress.update(progressPercent);
            }
        });

        // Событие при окончании проигрывания
        playerInstance.on("ended", () => {
            element.classList.remove("is-play");
            progress && progress.hide();

            // Показываем превью обратно
            //this.placeholder?.classList?.remove("hidden");
            //this.thumbnail?.classList?.remove("hidden");
            //this.duration?.classList?.remove("hidden");
            //this.playerWrap?.classList?.add("hidden");

            // Освобождаем плеер и HLS-движок: раньше hls.js оставался жить
            // и накапливал MSE-буферы при каждом досмотре
            //this._destroyPlayer();
        });

    }

    // ***************************************************************************
    // Глобальные прослушиватели
    // ***************************************************************************
    function globalEvents(): void {

        // Слушаем глобальные события. Подписка ставится ОДИН раз на сообщение
        // (в конструкторе), а не на каждый плеер: иначе повторные просмотры
        // плодили бы слушатели без возможности их снять.
        window.addEventListener("[app][audio]::media-play", (e) => {
            // Паузим это видео, если:
            // 1. Включили аудио
            // 2. Включили другое видео (ID не совпадает с нашим)
            if (!player) return;

            // Детали рассылаются только через CustomEvent — так читаем
            // detail без приведения типов события
            if (!(e instanceof CustomEvent)) return;

            if (e.detail.type === "audio" || (e.detail.type === "video" && e.detail.id !== current.id)) {
                player.pause();
            }
        });

    }

    // ***************************************************************************
    // Обработчики
    // ***************************************************************************
    function actions(): void {

        // Клик по thumbnails
        thumbnail?.addEventListener("click", () => {
            createPlayer();
        });

    }

    // Создаем DOM-элемент из шаблона
    const element = template();

    // Записываем ссылку на dom элемент
    if (!data.__domElements__) {
        data.__domElements__ = [];
    }
    data.__domElements__.push(element);

    // Функции обновления и чтения данных (хуки для загрузчика)
    data.__update__ = (next) => setup(next);
    data.__getData__ = () => current;

    // Устанавливаем начальные данные
    setup(data);

    // Прикрепляем обработчики событий
    actions();

    // Глобальная координация «кто играет» — одна подписка на всё сообщение
    globalEvents();

    // Возвращаем сам элемент для вставки в DOM
    return element;

}
