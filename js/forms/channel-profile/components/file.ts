// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import * as StorageUrl from "../../../utils/network/storage_url.js";
import { toastError } from "../../../utils/ui/toast_error.js";
import { formatBytes } from "../../../utils/string/format_bytes.js";
import { FileDownloader } from "../../../utils/network/file_downloader.js";
import { GestureController } from "../../../utils/gesture_controller.js";
import { IsMobile } from "../../../utils/helpers/is_mobile.js";

// Импортируем components
import { Buttons } from "../../../components/buttons.js";
import { ProgressIndicator } from "../../../components/progress.js";

// Импортируем handlers
import { ContextMenuHandler } from "./handlers/context_menu.js";

// Импортируем типы
import type { StoreEventName } from "../../../utils/store.js";
import { getErrorName } from "../../../utils/helpers/error_util.js";
import type { ChannelSectionItemData, ChannelProfile } from "../types.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * FileItem - строка вкладки «Файлы» профиля канала.
 *
 * Конструктор НЕ возвращает DOM-элемент (класс-фабрика — красный флаг
 * миграции): элемент отдаёт поле element, его берёт subscribe_section.
 * ***************************************************************************
 */
export class FileItem {

    /** Форма-владелец строки. */
    form: ChannelProfile;

    /** Данные вложения (id, token, file_name и т.д.). */
    data: ChannelSectionItemData;

    /** Корневой DOM-элемент строки. */
    element: HTMLElement;

    /** Имя файла. */
    name: HTMLElement | null = null;

    /** Размер файла. */
    size: HTMLElement | null = null;

    /** Кнопка скачивания. */
    downloadButton: Buttons | null = null;

    /** Прогресс-бар загрузки (пока идёт скачивание). */
    progress: ProgressIndicator | null = null;

    /** Загрузчик файла (пока идёт скачивание). */
    downloader: FileDownloader | null = null;

    /** Идёт ли сейчас скачивание (блокирует повторный запуск). */
    isDownloadProccess = false;

    /**
     * ***************************************************************************
     * constructor - Создаёт строку файла, вешает обработчики и подписки.
     * @param form - Экземпляр формы профиля канала.
     * @param data - Данные вложения.
     * ***************************************************************************
     */
    constructor(form: ChannelProfile, data: ChannelSectionItemData) {

        // Записываем данные
        this.form = form;
        this.data = data;

        // Создаем DOM-элемент из шаблона
        this.element = this._template();

        // Проставляем id элементу: по нему ScrollManager ищет якорь скролла
        // при вставке пачки в начало списка (см. functions/load_section.ts)
        if (data?.id) this.element.setAttribute("data-id", String(data.id));

        // Записываем ссылку на dom элемент
        if (!this.data.__domElements__) {
            this.data.__domElements__ = [];
        }
        this.data.__domElements__.push(this.element);

        // Устанавливаем начальные данные
        this._setup(this.data);

        // Прикрепляем обработчики событий
        this._actions();

        // Подписываем на обновление
        this._subscribeToUpdates();

    }

    // ***************************************************************************
    // Шаблон элемента (Private Method)
    // Используем <template> tag или DOMParser для создания DOM без innerHTML
    // ***************************************************************************
    _template(): HTMLElement {

        const tpl = new DOMParser().parseFromString(`
            <div class="item document relative flex flex-row items-center w-full gap-2 p-1 rounded-lg hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)] cursor-pointer">
                <button action-download></button>
                <div class="flex flex-col gap-0 justify-center overflow-hidden">
                    <span data-name class="font-semibold w-full truncate"></span>
                    <span data-size class="text-muted text-sm"></span>
                </div>
            </div>
        `, "text/html").querySelector<HTMLElement>(".item");

        // invariant: шаблон выше всегда содержит корневой .item
        if (!tpl) throw new Error("Не удалось разобрать шаблон строки файла");

        return tpl;

    }

    // ***************************************************************************
    // Установка/Перерисовка данных (Private Method)
    // ***************************************************************************
    _setup(data: ChannelSectionItemData): void {

        try {

            // Записываем данные
            this.data = data;

            // Устанавливаем элементы
            const downloadButton = this.element.querySelector("[action-download]");
            this.name = this.element.querySelector(":scope [data-name]");
            this.size = this.element.querySelector(":scope [data-size]");

            // Устанавливаем данные
            if (this.name) this.name.textContent = data.file_name || data.name || null;
            if (this.size) this.size.textContent = formatBytes(data.size ?? 0);

            // Устанавливаем кнопку управления
            this.downloadButton = Buttons.circle({
                attributes: ["action-download", "data-progress-wrap"],
                classes: ["relative"],
                icon: "ArrowBigDown",
                intent: "primary"
            });

            // Заменяем элемент кнопки
            downloadButton?.replaceWith(this.downloadButton.dom);

            // Логика отображения иконок
            if (this.data.__local_uri__) {
                this.downloadButton.setIcon("File");
            } else if (this.data.temp_id) {
                this.downloadButton.setIcon("File");
            } else {
                this.downloadButton.setIcon("ArrowBigDown");
            }

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Обработчики (Private Method)
    // ***************************************************************************
    _actions(): void {

        // Клик по кнопке (Отмена загрузки)
        this.downloadButton?.dom?.addEventListener("click", (event) => {
            if (!this.isDownloadProccess) return;

            event.stopPropagation();
            event.preventDefault();

            this._abortDownload();
        });

        // ======================

        // Конекстное меню или скачивание.
        // Слушатели живут на самом элементе, отдельная переменная не нужна
        new GestureController(this.element, {
            threshold: 5,
            onContextMenu: (event) => {
                event.preventDefault();
                if (!IsMobile.get()) {
                    event.stopPropagation();
                    ContextMenuHandler(event, this, "file");
                }
            },
            tap: {
                longTapTimeout: 500,
                onTap: async () => {
                    await this._initDownload();
                },
                onLongTap: (event) => {

                    // Если мобильная версия
                    if (IsMobile.get()) {
                        if (event.cancelable) event.preventDefault();
                        event.stopPropagation();
                        ContextMenuHandler(event, this, "file");
                    }

                }
            }
        });

    }

    // ***************************************************************************
    // Логика запуска загрузки
    // ***************************************************************************
    async _startDownload(): Promise<void> {
        this.isDownloadProccess = true;

        try {

            // Инициализация прогресс-бара
            this.progress = new ProgressIndicator({ width: "100%" });
            this.downloadButton?.dom?.appendChild(this.progress.getElement());
            this.progress.setProcessing();

            // Иконка "X" для отмены
            this.downloadButton?.setIcon("X");

            // Создаем загрузчик
            this.downloader = new FileDownloader({
                // StorageUrl, а не ручная сборка: `location.hostname` теряет порт,
                // и на нестандартном порту скачивание не работало
                url: StorageUrl.forStorage(this.data.id),
                file_token: this.data.token,
                file_name: this.data.file_name,
                callback: (loaded, total, percent) => {
                    if (this.progress) this.progress.update(percent);
                }
            });

            // Ждём завершения загрузки
            await this.downloader.download();

        } catch (error) {

            // Отмена по кнопке «X» — не ошибка, тост показывать незачем.
            // Всё остальное показываем пользователю
            if (getErrorName(error) === "AbortError") return;

            toastError(error, {
                context: "[app][channel-profile][file]::download",
                fallback: t("forms.channel_profile.toasts.download_error")
            });

        } finally {
            this._cleanupUI();
            this.isDownloadProccess = false;
        }
    }

    // ***************************************************************************
    // Принудительная остановка
    // ***************************************************************************
    _abortDownload(): void {
        if (this.downloader) this.downloader.destroy();
        this._cleanupUI();
    }

    // ***************************************************************************
    // Очистка UI после загрузки/ошибки/отмены
    // ***************************************************************************
    _cleanupUI(): void {

        // Удаляем прогресс
        if (this.progress) {
            this.progress.destroy();
            this.progress = null;
        }

        // Очищаем данные
        this.downloader = null;
        this.isDownloadProccess = false;

        // Возвращаем корректную иконку
        const iconName = this.data.__local_uri__ ? "File" : "ArrowBigDown";
        this.downloadButton?.setIcon(iconName);

    }

    // ***************************************************************************
    // Инициализация загрузки или открытия
    // ***************************************************************************
    async _initDownload(): Promise<void> {

        // Если идет скачивание
        if (this.isDownloadProccess) return;

        // Начинаем процесс загрузки
        await this._startDownload();

    }

    // ***************************************************************************
    // ПУБЛИЧНЫЙ МЕТОД: Обновление элемента
    // ***************************************************************************
    update(data: ChannelSectionItemData): void {

        // Передаем новые данные в _setup, чтобы перерисовать DOM
        this._setup(data);

    }

    // ***************************************************************************
    // Подписка на точечное событие обновления (Private Method)
    // ***************************************************************************
    _subscribeToUpdates(): void {

        try {

            // Формируем уникальное имя события
            const itemUpdatedEvent: StoreEventName = `item::updated::${this.data.id}`;

            // Подписываемся и сохраняем функцию отписки.
            // invariant: Store шлёт в событие ту же запись, что добавлена в хранилище
            const unsubscribe = this.form.fileStore.on(itemUpdatedEvent, (data) => {
                this.update(data as ChannelSectionItemData);
            });

            // Отписку снимает teardown через removeAll(): Store при очистке
            // удаляет динамические подписки элементов (utils/store.ts)
            this.data.__unsubscribeStore__ = unsubscribe;

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Геттер для удобного получения data
    // ***************************************************************************
    getData(): ChannelSectionItemData {
        return this.data;
    }

}
