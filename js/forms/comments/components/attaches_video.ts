// Импортируем справочник типов файлов
import { isKind } from "../../../config/file_types.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { CacheManager } from "../../../utils/cache_manager.js";
import { applyAspectRatio } from "../../../utils/media/apply_aspect_ratio.js";
import { applyDurationLabel } from "../../../utils/media/apply_duration_label.js";
import { getThumbnailSizeQuery } from "../../../utils/helpers/get_thumbnail_size_query.js";
import * as StorageUrl from "../../../utils/network/storage_url.js";
import * as Attachments from "../../../utils/messages/attachments.js";

// Импортируем forms
import { MediaViewer } from "../../media-viewer/index.js";

// Импортируем типы
import type { MediaItem } from "../../media-viewer/types.js";
import type { AttachParent, AttachmentData } from "./types.js";

/**
 * ***************************************************************************
 * createVideoItem - плитка видео-вложения: длительность, пропорции одиночного
 * медиа, превью (заглушка + серверная ссылка или локальный blob) и открытие
 * просмотрщика по клику.
 *
 * Легаси-класс возвращал DOM-узел из конструктора, поэтому состояние
 * (актуальные данные вложения) живёт в замыкании фабрики.
 * @param message - Родительское сообщение.
 * @param data - Данные вложения (id, name, metadata и т.д.).
 * @returns DOM-элемент вложения.
 * ***************************************************************************
 */
export function createVideoItem(message: AttachParent, data: AttachmentData): HTMLElement {

    // Актуальные данные вложения: __update__ может подменить объект
    let current = data;

    // **************************************************************************
    // Шаблон элемента
    // **************************************************************************
    function template(): HTMLElement {

        // invariant: корневой .item входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`
            <div class="item video flex flex-row relative w-full p-0 rounded-sm cursor-pointer overflow-hidden">
                <img data-thumbnail src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" class="object-cover w-full h-full z-2" draggable="false"/>
                <img data-placeholder src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" class="object-cover w-full h-full z-0 absolute" draggable="false" />
                <div data-duration class="z-3 absolute py-[0.15rem] px-[0.45rem] rounded-xl pointer-events-none bottom-1 left-1 bg-[var(--color-black)]/50 text-sm text-[var(--color-white)]"></div>
                <div data-progress-wrap class="z-3 absolute w-full h-full pointer-events-none"></div>
            </div>
        `, "text/html").querySelector<HTMLElement>(".item")!;
    }

    // **************************************************************************
    // Установка/Перерисовка данных
    // **************************************************************************
    function setup(data: AttachmentData): void {

        try {

            // Записываем данные
            current = data;

            // Устанавливаем элементы
            const placeholder = element.querySelector<HTMLImageElement>(":scope [data-placeholder]");
            const thumbnail = element.querySelector<HTMLImageElement>(":scope [data-thumbnail]");
            const duration = element.querySelector<HTMLElement>(":scope [data-duration]");

            // Длительность. Показываем только когда она реально известна,
            // иначе бейдж скрывается, а не врёт «00:00».
            applyDurationLabel(duration, data?.metadata);

            // Вычисляем aspect-ratio. Если пропорции неизвестны, стиль не
            // трогаем: у плитки в CSS свой квадрат, а у одиночного вложения —
            // свои 16/9, и инлайновый фолбэк их перебил бы.
            let width = data?.metadata?.original?.width || undefined;
            let height = data?.metadata?.original?.height || undefined;

            // Получаем все media
            const attachments = message?.data?.attachments;
            const mediaCount: unknown[] = [];

            // Получаем все медиа в сообщении. Нормализация приводит серверный
            // массив и temp-object-map к одному виду — индексация по ключу
            // объекта падала бы на массиве.
            for (const attach of Attachments.normalize(attachments)) {
                if (isKind("image", attach.type || attach.mime_type)) mediaCount.push(attach);
                if (isKind("video", attach.type || attach.mime_type)) mediaCount.push(attach);
            }

            // Пропорции применяем, только когда в сообщении одно медиа:
            // в плитке итоговую геометрию задаёт CSS.
            if (mediaCount.length === 1) {
                applyAspectRatio(
                    [element, placeholder, thumbnail],
                    width,
                    height
                );
            }

            // Если есть placeholder у видео
            if (placeholder && data?.metadata?.placeholder) {
                placeholder.src = data.metadata.placeholder;
            }

            // Запоминаем предыдущую ссылку ДО подмены: освобождать её надо
            // после присваивания новой, иначе revoke убьёт только что
            // установленный blob и превью не отрисуется.
            const previousThumbnailSrc = thumbnail?.src;

            // Если есть thumbnails у видео и массив НЕ пустой
            if (data?.metadata?.thumbnails && data.metadata.thumbnails.length > 0) {

                // Получения размера миниатюры
                const thumbnails = data?.metadata?.thumbnails;

                // sizeQuery теперь гарантированно содержит объект { thumb, string }
                const sizeQuery = getThumbnailSizeQuery(thumbnails, 400);
                const thumb = sizeQuery.thumb;

                // Ссылка на превью (blob: у локального, кеш/сервер — у загруженного)
                let thumbnailUrl: string | null = null;

                // Если превью это File или Blob (загружается прямо сейчас на клиенте).
                // thumb === false означает «превью нет» — поля читаем только у миниатюры.
                if (thumb !== false && (thumb._file instanceof File || thumb._file instanceof Blob)) {
                    // invariant: у локальной миниатюры есть blob-ссылка _url
                    thumbnailUrl = thumb._url as string;
                } else {

                    // Функция getThumbnailSizeQuery уже возвращает готовую строку вида "?size=400".
                    // id есть у серверного файла; у локального берётся ветка
                    // выше — пустая строка лишь закрывает тип (легаси строила
                    // битую ссылку с undefined в URL)
                    const srcThumbnail = StorageUrl.forStorage(data.id ?? "", { size: thumb !== false ? thumb.width : undefined });

                    thumbnailUrl = CacheManager.getMediaSrc({
                        url: srcThumbnail,
                        file_token: data.token,
                        type: "image"
                    });

                }

                // Прячем размытую заглушку, когда превью уже загрузилось.
                // Раньше обработчик висел только в ветке серверной ссылки, и
                // для локального blob он не срабатывал вовсе.
                if (thumbnail) {
                    thumbnail.onload = () => {
                        placeholder?.classList.add("hidden");
                    };

                    thumbnail.src = thumbnailUrl;
                }

            }

            // Освобождаем предыдущую blob-ссылку превью. Апдейтов метадаты
            // будет минимум два (локальная, затем серверная), и без этого
            // каждый оставлял бы в памяти свой Blob.
            if (previousThumbnailSrc?.startsWith("blob:")) {
                URL.revokeObjectURL(previousThumbnailSrc);
            }

        } catch (error) {
            Logger.error("Setup Error:", error);
        }

    }

    // **************************************************************************
    // Обработчики
    // **************************************************************************
    function actions(): void {

        // Клик для открытия просмотра видео
        element?.addEventListener("click", (event) => {
            event.stopPropagation();

            // Устанавливаем параметры
            let media: MediaItem[] = [];

            // Получаем все медиа в сообщении.
            // Нормализуем вложения: сервер отдаёт массив, локальные (temp/pending)
            // сообщения — объект-мап, поэтому .forEach на объекте падал.
            // Копия элемента нужна контракту MediaViewer (id обязателен):
            // значение id и локальные поля (_file) сохраняются как есть.
            // У локального вложения id ещё нет — передаём пустую строку
            // (легаси уходил undefined; оба значения falsy)
            Attachments.normalize(message.data.attachments).forEach(attach => {
                if (isKind("image", attach.type || attach.mime_type)) media.push({ ...attach, id: attach.id ?? "" });
                if (isKind("video", attach.type || attach.mime_type)) media.push({ ...attach, id: attach.id ?? "" });
            });

            // Находим индекс элемента, на который кликнули
            const startIndex = media.findIndex(attach => attach.id === current.id);

            // Открываем просмотрщик
            new MediaViewer({
                media: media,
                options: {
                    startIndex: startIndex !== -1 ? startIndex : 0
                }
            });

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

    // Возвращаем сам элемент для вставки в DOM
    return element;

}
