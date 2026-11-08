// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { Icons } from "../../../utils/icons.js";
import { formatBytes } from "../../../utils/string/format_bytes.js";
import { CacheManager } from "../../../utils/cache_manager.js";
import { getThumbnailSizeQuery } from "../../../utils/helpers/get_thumbnail_size_query.js";

// Импортируем components
import { Buttons } from "../../../components/buttons.js";
import { ProgressIndicator } from "../../../components/progress.js";

// Импортируем handlers (контекстное меню файла)
import { openFileActions } from "./handlers/file_actions.js";

// Импортируем handlers формы
import { downloadFileHandler } from "../handlers/download_file.js";

// Импортируем functions
import { getFileIcon } from "../functions/file_icon.js";

// Импортируем типы
import { isCloudItem } from "../types.js";
import type { CloudItem, CloudItemMode } from "../types.js";
import type { Store } from "../../../utils/store.js";
import type { Cloud } from "../index.js";

// Типы изображений (для превью)
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg"];

/**
 * Контракт компонента файла для его контекстного меню.
 */
export interface CloudFileItemHandle {

    /** Экземпляр формы облака. */
    form: Cloud;

    /** Данные файла. */
    data: CloudItem;

    /** Режим навигации элемента. */
    mode: CloudItemMode;

}

/**
 * ***************************************************************************
 * Строка списка файла (своё облако либо общий доступ), включая состояние
 * загрузки с прогрессом и кнопкой отмены.
 *
 * @param form - Экземпляр формы облака.
 * @param data - Данные файла.
 * @param store - Хранилище элементов (по умолчанию — своё облако).
 * @param mode - Режим навигации ["mine" | "shared"].
 * @returns Готовый DOM-элемент строки.
 * ***************************************************************************
 */
export function createCloudFileItem(
    form: Cloud,
    data: CloudItem,
    store?: Store<CloudItem>,
    mode: CloudItemMode = "mine"
): HTMLElement {

    // Записываем данные: setup обновляет ссылку, как раньше это делал this.data
    let current = data;
    const ownerStore = store || form.store;

    // Создаем DOM-элемент из шаблона
    const element = template();

    // Записываем ссылку на dom элемент
    if (!current.__domElements__) {
        current.__domElements__ = [];
    }
    current.__domElements__.push(element);

    // Устанавливаем начальные данные
    setup(current);

    // Прикрепляем обработчики событий
    actions();

    // Подписываем на обновление
    subscribeToUpdates();

    // Возвращаем сам элемент для вставки в DOM
    return element;

    /**
     * ***************************************************************************
     * Форматирование даты загрузки файла.
     * @param createdAt - Дата загрузки (ISO-строка).
     * @returns Отформатированная дата (например, "23.09.2026").
     * ***************************************************************************
     */
    function formatDate(createdAt: string): string {

        // Создаем дату и форматируем по локали браузера
        return new Date(createdAt).toLocaleDateString();

    }

    /**
     * ***************************************************************************
     * Шаблон элемента: плитка либо строка списка (по типу просмотра формы).
     * @returns DOM-элемент строки.
     * ***************************************************************************
     */
    function template(): HTMLElement {

        // ---------- РЕЖИМ ПЛИТКИ ----------
        if (form.view === "grid") {
            // invariant: шаблон выше — наши строки, .item в нём всегда есть
            return new DOMParser().parseFromString(`
                <div class="item relative flex flex-col gap-1 p-2 items-center bg-[var(--second-bg)] hover:bg-[var(--color-black)]/5 active:bg-[var(--color-black)]/10 dark:hover:bg-[var(--color-white)]/10 dark:active:bg-[var(--color-white)]/15 cursor-pointer rounded-lg transition-all duration-200 motion-reduce:transition-none motion-safe:hover:scale-[1.02] motion-safe:hover:shadow-md motion-safe:active:scale-[.99]">
                    <div data-icon class="flex items-center justify-center shrink-0 w-12 h-12 bg-[var(--color-brand)]/10 text-[var(--color-brand)] rounded-lg">${Icons.icon("file", { settings: { size: 28 } })?.outerHTML}</div>
                    <div class="flex flex-col gap-0 w-full min-w-0 items-center">
                        <span data-name class="text-xs text-center truncate w-full"></span>
                        <span data-meta class="text-[0.625rem] text-muted truncate w-full text-center"></span>
                        <span data-date class="text-[0.625rem] text-muted truncate w-full text-center"></span>
                        <div data-progress-wrap class="hidden pt-1 w-full"></div>
                    </div>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-menu"], icon: { name: "dots", settings: { size: 14 } }, classes: ["absolute", "top-0.5", "right-0.5", "p-1!"] })}
                </div>
            `, "text/html").querySelector<HTMLElement>(".item")!;
        }

        // ---------- РЕЖИМ СПИСКА ----------
        // invariant: шаблон выше — наши строки, .item в нём всегда есть
        return new DOMParser().parseFromString(`
            <div class="item flex flex-row gap-2 p-2 py-1 items-center bg-[var(--second-bg)] hover:bg-[var(--color-black)]/5 active:bg-[var(--color-black)]/10 dark:hover:bg-[var(--color-white)]/10 dark:active:bg-[var(--color-white)]/15 cursor-pointer rounded-lg">
                <div class="flex flex-row gap-2 items-center w-full min-w-0">
                    <div data-icon class="flex items-center justify-center shrink-0 w-8 h-8 bg-[var(--color-brand)]/10 text-[var(--color-brand)] rounded-lg">${Icons.icon("file", { settings: { size: 20 } })?.outerHTML}</div>
                    <div class="flex flex-col gap-0 min-w-0 flex-1">
                        <span data-name class="text-sm truncate"></span>
                        <div class="flex flex-row">
                            <span data-meta class="text-xs text-muted truncate"></span>
                            <span data-separator class="px-1 text-xs text-muted">-</span>
                            <span data-date class="text-xs text-muted truncate"></span>
                        </div>
                        <div data-progress-wrap class="hidden pt-1"></div>
                    </div>
                </div>
                ${Buttons.transparent({ shape: "circle", attributes: ["action-menu"], icon: "dots" })}
            </div>
        `, "text/html").querySelector<HTMLElement>(".item")!;

    }

    /**
     * ***************************************************************************
     * Установка/Перерисовка данных.
     * @param next - Новые данные файла.
     * ***************************************************************************
     */
    function setup(next: CloudItem): void {

        try {

            // Сохраняем актуальные данные
            current = next;

            // Устанавливаем элементы
            const name = element.querySelector<HTMLElement>(":scope [data-name]");
            const meta = element.querySelector<HTMLElement>(":scope [data-meta]");
            const date = element.querySelector<HTMLElement>(":scope [data-date]");

            // Отображаем имя файла
            if (name) {
                name.textContent = next.file_name || next.name || "";
            }

            // Отображаем размер файла
            if (meta) {
                meta.textContent = formatBytes(next.size || 0);
            }

            // Отображаем дату загрузки файла
            if (date) {
                date.textContent = next.created_at ? formatDate(next.created_at) : "";
            }

            // Отображаем иконку (превью для изображений)
            renderIcon(next);

            // Отображаем состояние загрузки
            updateUploadState(next);

        } catch (error) {
            Logger.error(error);
        }

    }

    /**
     * ***************************************************************************
     * Отображение иконки: превью для изображений, иначе — иконка по типу файла
     * @param data - Данные файла.
     * ***************************************************************************
     */
    function renderIcon(data: CloudItem): void {

        // Получаем контейнер иконки
        let iconWrap = element.querySelector<HTMLElement>(":scope [data-icon]");
        if (!iconWrap) return;

        // Если файл ещё загружается — иконка по умолчанию
        if (data.is_uploading) return;

        // Проверяем, является ли файл изображением
        let ext = (data.extname || "").toLowerCase().replace(".", "");
        let mime = (data.mime_type || "").toLowerCase();
        let isImage = IMAGE_EXTENSIONS.includes(ext) || mime.startsWith("image/");

        // Размер иконки зависит от типа просмотра
        let iconSize = form.view === "grid" ? 28 : 20;
        let imageClass = form.view === "grid" ? "w-12 h-12 object-cover rounded-xl" : "w-8 h-8 object-cover rounded-lg";

        // Если изображение и есть токен — показываем превью
        if (isImage && data.token) {

            // Получения размера миниатюры
            // (spread-мап: MediaThumbnail — интерфейс без индексной подписи,
            // утилита читает только width, копия полей безопасна)
            const thumbnails = data?.metadata?.thumbnails;
            let sizeQuery = getThumbnailSizeQuery(thumbnails?.map(t => ({ ...t })), 400);

            iconWrap.innerHTML = "";
            let url = CacheManager.getMediaSrc({
                url: `${window.location.protocol}//${window.location.hostname}/api/v1/storage/${data.document_id || data.id}${sizeQuery?.string}`,
                file_token: data.token,
                type: "image"
            });
            let img = document.createElement("img");
            img.src = url;
            img.className = imageClass;
            img.loading = "lazy";
            iconWrap.appendChild(img);
            return;
        }

        // Иначе — иконка по типу файла
        iconWrap.innerHTML = "";
        const fileIcon = Icons.icon(getFileIcon(data), { settings: { size: iconSize } });
        if (fileIcon) iconWrap.appendChild(fileIcon);

    }

    /**
     * ***************************************************************************
     * Отображение состояния загрузки файла (прогресс)
     * @param data - Данные файла.
     * ***************************************************************************
     */
    function updateUploadState(data: CloudItem): void {

        // Контейнер прогресса
        let progressWrap = element.querySelector<HTMLElement>(":scope [data-progress-wrap]");
        if (!progressWrap) return;

        // Если файл загружается — показываем прогресс
        if (data.is_uploading) {
            elementMenuToggle(true);
            progressWrap.classList.remove("hidden");

            // Если после перерисовки вида старые инстансы прогресса
            // остались без DOM — сбрасываем их (иначе прогресс не создастся)
            if (data.__progressInstances__) {
                data.__progressInstances__ = data.__progressInstances__.filter(
                    p => p.getElement()?.isConnected
                );
            }

            // Создаём компонент прогресса один раз
            if (!data.__progressInstances__) {
                let progress = new ProgressIndicator({ width: "100%" });
                let progressElement = progress.getElement();

                // По клику на прогресс — отменяем загрузку
                progressElement?.addEventListener("click", () => {
                    data.__uploader__?.destroy();
                    ownerStore.remove(data.id);
                });

                progressWrap.appendChild(progressElement);
                progress.setProcessing();
                data.__progressInstances__ = [progress];
            }

        } else {

            // Если загрузка завершена — убираем прогресс
            elementMenuToggle(false);
            progressWrap.classList.add("hidden");

            // Уничтожаем инстансы прогресса
            if (data.__progressInstances__) {
                data.__progressInstances__.forEach(p => p.destroy());
                data.__progressInstances__ = [];
            }
            progressWrap.innerHTML = "";

        }

    }

    /**
     * ***************************************************************************
     * Показ/скрытие кнопки действий при загрузке файла
     * @param isUploading - Флаг «файл загружается».
     * ***************************************************************************
     */
    function elementMenuToggle(isUploading: boolean): void {

        // Кнопка действий
        let menu = element.querySelector<HTMLElement>("[action-menu]");
        if (menu) {
            if (isUploading) {
                menu.classList.add("hidden");
            } else {

                // В общем доступе кнопка возвращается только при праве записи
                let canWrite = ["owner", "write"].includes(
                    form.sharedAccessLevel || form.sharedLink?.access_level || "read"
                );
                if (mode !== "shared" || canWrite) {
                    menu.classList.remove("hidden");
                }

            }
        }

    }

    /**
     * ***************************************************************************
     * Обработчики: скачивание файла и контекстное меню.
     * ***************************************************************************
     */
    function actions(): void {

        // Клик по элементу — скачиваем файл (если не идёт загрузка)
        element.addEventListener("click", () => {
            if (current.is_uploading) return;
            downloadFileHandler(current);
        });

        // Кнопка действий — контекстное меню
        // (в общем доступе — только при праве записи)
        let menu = element.querySelector<HTMLElement>("[action-menu]");
        let canWrite = ["owner", "write"].includes(
            form.sharedAccessLevel || form.sharedLink?.access_level || "read"
        );
        if (mode === "shared" && !canWrite) {
            menu?.classList.add("hidden");
        } else {
            menu?.classList.remove("hidden");
            menu?.addEventListener("click", (event) => {
                event.stopPropagation();
                if (current.is_uploading) return;
                openFileActions(event, handle());
            });
        }

    }

    /**
     * ***************************************************************************
     * Подписка на точечное событие обновления файла.
     * ***************************************************************************
     */
    function subscribeToUpdates(): void {

        try {

            // Обновляем элемент при изменении данных
            ownerStore.on(`item::updated::${current.id}`, (payload) => {
                update(payload);
            });

        } catch (error) {
            Logger.error(error);
        }

    }

    /**
     * ***************************************************************************
     * Обновление элемента: передаём новые данные в setup, чтобы перерисовать DOM.
     * @param payload - Полезная нагрузка события обновления.
     * ***************************************************************************
     */
    function update(payload: unknown): void {

        // Стор шлёт payload как unknown — сверяемся guard'ом
        if (!isCloudItem(payload)) return;

        // Передаем новые данные в setup, чтобы перерисовать DOM
        setup(payload);

    }

    /**
     * Вид компонента для контекстного меню (data всегда актуальный).
     * @returns Дескриптор компонента.
     */
    function handle(): CloudFileItemHandle {
        return { form, data: current, mode };
    }

}
