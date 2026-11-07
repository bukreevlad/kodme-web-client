// Импортируем справочник типов файлов
import { isKind } from "../../../config/file_types.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { applyAspectRatio } from "../../../utils/media/apply_aspect_ratio.js";
import { getThumbnailSizeQuery } from "../../../utils/helpers/get_thumbnail_size_query.js";
import * as Attachments from "../../../utils/messages/attachments.js";

// Импортируем forms
import { MediaViewer } from "../../media-viewer/index.js";

// Импортируем типы
import { normalizeAttachments, sortAttachmentsByFiles } from "./types.js";
import type { MediaItem } from "../../media-viewer/types.js";
import type { AttachParent, AttachmentData } from "./types.js";

/**
 * ***************************************************************************
 * createImageItem - плитка изображения: placeholder, серверное/локальное
 * превью с освобождением blob-ссылок и открытие просмотрщика по клику.
 *
 * Легаси-класс возвращал DOM-узел из конструктора, поэтому состояние
 * (актуальные данные, владеемая blob-ссылка) живёт в замыкании фабрики.
 * @param message - Родительское сообщение.
 * @param data - Данные вложения (id, name, metadata и т.д.).
 * @returns DOM-элемент вложения.
 * ***************************************************************************
 */
export function createImageItem(message: AttachParent, data: AttachmentData): HTMLElement {

    // Актуальные данные вложения: __update__ может подменить объект
    let current = data;

    // Blob-ссылка, которой владеет этот компонент (нужен для revoke)
    let ownedImageUrl: string | null = null;

    // **************************************************************************
    // Шаблон элемента
    // Используем DOMParser для безопасного и чистого создания элемента
    // **************************************************************************
    function template(): HTMLElement {

        // Мы используем <template> tag или DOMParser для создания DOM без innerHTML
        // invariant: корневой .item входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`

            <div class="item image relative flex flex-row items-center justify-center rounded-sm p-0 bg-[var(--second-bg)] cursor-pointer overflow-hidden">
                <img data-placeholder src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" class="object-cover w-full h-full absolute" draggable="false" />
                <img data-image src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" class="z-1 object-cover w-full h-full" draggable="false" />
                <div data-progress-wrap class="z-2 absolute w-full h-full pointer-events-none"></div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".item")!;

    }

    // **************************************************************************
    // Установка/Перерисовка данных
    // **************************************************************************
    function setup(data: AttachmentData): void {

        try {

            // Сохраняем актуальные данные
            current = data;

            // Устанавливаем элементы
            const placeholder = element.querySelector<HTMLImageElement>(":scope [data-placeholder]");
            const image = element.querySelector<HTMLImageElement>(":scope [data-image]");

            // Оба узла входят в шаблон — без них плитку не перерисовать
            if (!placeholder || !image) return;

            // Вычисляем aspect-ratio. Фолбэк не задаём: у плитки в CSS свой
            // квадрат, а у одиночной картинки — 16/9, и инлайновый 1/1 их бы
            // перебил.
            let width = data?.metadata?.original?.width || null;
            let height = data?.metadata?.original?.height || null;

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
            // в плитке итоговую геометрию задаёт CSS
            // (null нормализуем к undefined — так «нет данных» принимает API).
            // Видимый thumbnail входит в список: именно он занимает место
            // вместо оригинала (как в attaches_video)
            if (mediaCount.length === 1) {
                applyAspectRatio([element, placeholder, image], width ?? undefined, height ?? undefined);
            }

            // Если есть placeholder у картинки
            if (data?.metadata?.placeholder) {
                placeholder.src = data?.metadata?.placeholder;
            }

            // Ссылка, которой владеем мы (создали сами). Ссылки из
            // metadata.thumbnails принадлежат генератору, и их revoke здесь
            // сломал бы превью сразу во всех компонентах — поэтому отдельно
            // запоминаем только «свои». Старую освободим в конце, уже после
            // подмены src, иначе revoke убьёт только что установленный blob.
            const staleImageUrl = ownedImageUrl;
            ownedImageUrl = null;

            // Размер локального превью. Оригинал с телефона легко весит
            // 12 мегапикселей, а в списке сообщений картинка занимает
            // ~300px — декодировать полный размер ради этого дорого.
            // По клику открывается просмотрщик с оригиналом, так что
            // качество в превью не теряется.
            const sizeQuery = getThumbnailSizeQuery(data?.metadata?.thumbnails, 800);
            const thumb = sizeQuery.thumb;

            // thumb === false означает «превью нет» — поля читаем только у миниатюры
            if (thumb !== false && (thumb._file instanceof File || thumb._file instanceof Blob)) {

                // Локальное превью ещё не загружено на сервер
                // invariant: у локальной миниатюры есть blob-ссылка _url
                image.src = thumb._url as string;

            } else if (data?._file instanceof File || data?._file instanceof Blob) {

                // Превью построить не удалось — показываем сам файл
                image.src = URL.createObjectURL(data._file);
                ownedImageUrl = image.src;

            } else {

                // Серверного хранилища у секретных чатов нет: пока оригинал не
                // принят (и миниатюры нет) остаётся placeholder из метадаты
                Logger.debug("[secret-chat][ImageItem]: источник изображения пока недоступен.");

            }

            // Освобождаем blob предыдущего кадра. Апдейтов метадаты будет
            // минимум два (локальная, затем серверная), и без этого каждый
            // оставлял бы в памяти свой Blob.
            if (staleImageUrl) {
                URL.revokeObjectURL(staleImageUrl);
            }

        } catch (error) {
            Logger.error(error);
        }

    }

    // **************************************************************************
    // Обработчики
    // **************************************************************************
    function actions(): void {

        // Клик для открытия просмотра изображения
        element?.addEventListener("click", (event) => {
            event.stopPropagation();

            // Устанавливаем параметры
            let media: MediaItem[] = [];

            // Получаем все изображения и видео в сообщении в порядке файлов
            // payload (как они разложены в ленте).
            // Нормализуем вложения: сервер отдаёт массив, локальные (temp/pending)
            // сообщения — объект-мап, поэтому .forEach на объекте падал.
            // Копия элемента нужна контракту MediaViewer (id обязателен):
            // значение id и локальные поля (_file) сохраняются как есть.
            const ordered = sortAttachmentsByFiles(normalizeAttachments(message.data.attachments), message.data.files);
            for (const attach of ordered) {

                // Просмотрщик открываем только готовым файлам (расшифрованный
                // оригинал в _file): до прихода оригинала показывать нечего
                if (attach.id == null) continue;
                if (!(attach._file instanceof File || attach._file instanceof Blob)) continue;

                if (isKind("image", attach.type || attach.mime_type)) media.push({ ...attach, id: attach.id });
                if (isKind("video", attach.type || attach.mime_type)) media.push({ ...attach, id: attach.id });
            }

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
