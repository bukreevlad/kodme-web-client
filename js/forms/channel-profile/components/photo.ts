// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { CacheManager } from "../../../utils/cache_manager.js";
import { IsMobile } from "../../../utils/helpers/is_mobile.js";
import { GestureController } from "../../../utils/gesture_controller.js";
import { getThumbnailSizeQuery } from "../../../utils/helpers/get_thumbnail_size_query.js";
import * as StorageUrl from "../../../utils/network/storage_url.js";

// Импортируем components
import { MediaViewer } from "../../media-viewer/index.js";

// Импортируем handlers
import { ContextMenuHandler } from "./handlers/context_menu.js";

// Импортируем типы
import type { StoreEventName } from "../../../utils/store.js";
import type { ChannelSectionItemData, ChannelProfile } from "../types.js";

/**
 * ***************************************************************************
 * PhotoItem - строка вкладки «Фото» профиля канала.
 *
 * Конструктор НЕ возвращает DOM-элемент (класс-фабрика — красный флаг
 * миграции): элемент отдаёт поле element, его берёт subscribe_section при
 * вставке строки в список.
 * ***************************************************************************
 */
export class PhotoItem {

    /** Форма-владелец строки. */
    form: ChannelProfile;

    /** Данные вложения (id, token, metadata и т.д.). */
    data: ChannelSectionItemData;

    /** Корневой DOM-элемент строки. */
    element: HTMLElement;

    /** Плейсхолдер-заглушка под основной картинкой. */
    placeholder: HTMLImageElement | null = null;

    /** Основная картинка. */
    image: HTMLImageElement | null = null;

    /** Контроллер жестов (tap — просмотрщик, долгий тап/правый клик — меню). */
    gestureController: GestureController | null = null;

    /**
     * ***************************************************************************
     * constructor - Создаёт строку фото, вешает обработчики и подписки.
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

        // Функция для обновления данных
        this.data.__update__ = (data) => this.update(data);
        this.data.__getData__ = () => this.getData();

        // Отписка от слушателей документа: вызывается из
        // events/store/subscribe_section при удалении строки из Store
        this.data.__destroy__ = () => this.destroy();

        // Устанавливаем начальные данные
        this._setup(this.data);

        // Прикрепляем обработчики событий
        this._actions();

        // Подписываем на обновление
        this._subscribeToUpdates();

    }

    // ***************************************************************************
    // Шаблон элемента (Private Method)
    // Используем DOMParser для безопасного и чистого создания элемента
    // ***************************************************************************
    _template(): HTMLElement {

        // DOMParser вместо innerHTML: текст приходит с сервера
        const tpl = new DOMParser().parseFromString(`

            <div class="item image relative flex flex-row items-center justify-center p-0 aspect-1/1 rounded-sm bg-[var(--second-bg)] cursor-pointer overflow-hidden">
                <img data-placeholder src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" class="object-cover w-full h-full absolute" draggable="false" />
                <img data-image src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" class="z-1 object-cover w-full h-full" draggable="false" />
                <div data-progress-wrap class="z-2 absolute w-full h-full pointer-events-none"></div>
            </div>
            
        `, "text/html").querySelector<HTMLElement>(".item");

        // invariant: шаблон выше всегда содержит корневой .item
        if (!tpl) throw new Error("Не удалось разобрать шаблон строки фото");

        return tpl;

    }

    // ***************************************************************************
    // Установка/Перерисовка данных (Private Method)
    // ***************************************************************************
    async _setup(data: ChannelSectionItemData): Promise<void> {

        try {

            // Сохраняем актуальные данные
            this.data = data;

            // Устанавливаем элементы
            this.placeholder = this.element.querySelector(":scope [data-placeholder]");
            this.image = this.element.querySelector(":scope [data-image]");

            // Если есть placeholder у картинки
            if (this.data?.metadata?.placeholder && this.placeholder) {
                this.placeholder.src = this.data.metadata.placeholder;
            }

            // Очищаем ссылку от утечки памяти
            if (this.image?.src.startsWith("blob:")) {
                URL.revokeObjectURL(this.image.src);
            }

            // Проверяем instance
            if (data?._file instanceof File || data?._file instanceof Blob) {

                // Создаем временную ссылку для браузера
                if (this.image) this.image.src = URL.createObjectURL(data._file);

            } else {

                try {

                    // Получения размера миниатюры
                    const thumbnails = this.data?.metadata?.thumbnails;
                    const sizeQuery = getThumbnailSizeQuery(thumbnails, 800);

                    // Формируем ссылку через StorageUrl + CacheManager:
                    // StorageUrl берёт origin целиком, включая порт
                    const mediaUrl = CacheManager.getMediaSrc({
                        // GetThumbnailSizeQuery отдаёт размер в `thumb.width`,
                        // а не в `size`; при отсутствии превью — `thumb: false`,
                        // и тогда ссылка ведёт на оригинал без query
                        url: StorageUrl.forStorage(this.data.id, { size: sizeQuery.thumb ? sizeQuery.thumb.width : undefined }),
                        file_token: this.data.token,
                        type: "image"
                    });

                    // Устанавливаем ссылку
                    if (this.image) this.image.src = mediaUrl;

                } catch {
                    // Тут можно поставить картинку "ошибка загрузки"
                }

            }

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Обработчики (Private Method)
    // ***************************************************************************
    _actions(): void {

        // Жесты вместо голого click: на мобильных просмотрщик открывается
        // тапом, а контекстное меню — долгим тапом; на ПК меню вызывается
        // правым кликом. Слушатель click здесь больше не вешается: после
        // долгого тапа браузер генерирует синтетический click, и просмотрщик
        // открылся бы поверх меню
        this.gestureController = new GestureController(this.element, {
            threshold: 5,
            tap: {
                longTapTimeout: 500,
                onTap: () => this._openViewer(),
                onLongTap: (event) => {

                    // Долгий тап — мобильное меню; на ПК то же делает правый клик
                    if (!IsMobile.get()) return;
                    if (event.cancelable) event.preventDefault();

                    ContextMenuHandler(event, this, "photo");

                }
            },
            onContextMenu: (event) => {

                event.preventDefault();

                // На мобильных долгое удержание порождает и contextmenu, и
                // долгий тап — меню открывает только один из них
                if (!IsMobile.get()) {

                    event.stopPropagation();
                    ContextMenuHandler(event, this, "photo");

                }

            }
        });

    }

    // ***************************************************************************
    // Открытие просмотрщика изображений (Private Method)
    // ***************************************************************************
    _openViewer(): void {

        // Получаем все фото секции
        const media = [...this.form.photoStore.getAll()];

        // Находим индекс элемента, на который кликнули
        const startIndex = media.findIndex(attach => attach.id === this.data.id);

        // Открываем просмотрщик
        new MediaViewer({
            media: media,
            options: {
                startIndex: startIndex !== -1 ? startIndex : 0
            }
        });

    }

    // ***************************************************************************
    // Очистка строки при удалении из Store (снимает слушатели жестов)
    // ***************************************************************************
    destroy(): void {

        // Контроллер жестов держит слушатели на document — без destroy
        // они переживали бы удалённую строку
        this.gestureController?.destroy();

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
            const unsubscribe = this.form.photoStore.on(itemUpdatedEvent, (data) => {
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
