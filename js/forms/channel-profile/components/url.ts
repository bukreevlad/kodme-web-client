// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { IsMobile } from "../../../utils/helpers/is_mobile.js";
import { GestureController } from "../../../utils/gesture_controller.js";

// Импортируем components
import { Avatars } from "../../../components/avatars.js";

// Импортируем handlers
import { ContextMenuHandler } from "./handlers/context_menu.js";

// Импортируем dialogs
import { MessageUrlClickConfirm } from "../../messages/components/dialogs/message-url-click-confirm/index.js";

// Импортируем utils (ссылки)
import { attach } from "../../../utils/links/link_guard.js";

// Импортируем типы
import type { StoreEventName } from "../../../utils/store.js";
import type { ChannelSectionItemData, ChannelProfile } from "../types.js";

/**
 * ***************************************************************************
 * UrlItem - строка вкладки «Ссылки».
 *
 * Два важных момента:
 *
 * 1. Слушатели ссылок вешаются в _renderUrls(): _setup() пересоздаёт узлы
 *    (`urls.textContent = ""`), поэтому обработчики ставятся на каждую
 *    отрисовку заново. Жесты строки (долгий тап/правый клик — меню)
 *    живут в _actions(): сам корневой элемент _setup не пересоздаёт.
 *
 * 2. id записи — это id СООБЩЕНИЯ (сервер отдаёт `m.id`), а не пользователя и
 *    не канала. Поэтому аватара у автора нет: сервер не присылает его. Пока
 *    данных нет, показываем заглушку по имени, а не выдаём цвет от id
 *    сообщения.
 *
 * Конструктор не возвращает DOM-элемент: элемент отдаёт поле element,
 * его берёт subscribe_section при вставке строки в список.
 * ***************************************************************************
 */
export class UrlItem {

    /** Форма-владелец строки. */
    form: ChannelProfile;

    /** Данные записи (id сообщения, display_name, urls). */
    data: ChannelSectionItemData;

    /** Корневой DOM-элемент строки. */
    element: HTMLElement;

    /** Контроллер жестов (долгий тап/правый клик — контекстное меню). */
    gestureController: GestureController | null = null;

    /**
     * ***************************************************************************
     * constructor - Создаёт строку ссылки, вешает подписки.
     * @param form - Экземпляр формы профиля канала.
     * @param data - Данные записи (id сообщения, display_name, urls).
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

        // Устанавливаем начальные данные (вместе со слушателями)
        this._setup(this.data);

        // Прикрепляем обработчики жестов (контекстное меню строки)
        this._actions();

        // Подписываем на обновление
        this._subscribeToUpdates();

    }

    // ***************************************************************************
    // Обработчики (Private Method)
    // ***************************************************************************
    _actions(): void {

        // Контекстное меню строки: на мобильных — долгий тап, на ПК — правый
        // клик. Тапа (onTap) у строки нет: открытие ссылок — работа самих <a>,
        // которые перерисовываются в _renderUrls
        this.gestureController = new GestureController(this.element, {
            threshold: 5,
            tap: {
                longTapTimeout: 500,
                onLongTap: (event) => {

                    // Долгий тап — мобильное меню; на ПК то же делает правый клик
                    if (!IsMobile.get()) return;
                    if (event.cancelable) event.preventDefault();

                    ContextMenuHandler(event, this, "url");

                }
            },
            onContextMenu: (event) => {

                event.preventDefault();

                // На мобильных долгое удержание порождает и contextmenu, и
                // долгий тап — меню открывает только один из них
                if (!IsMobile.get()) {

                    event.stopPropagation();
                    ContextMenuHandler(event, this, "url");

                }

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
    // Шаблон элемента (Private Method)
    // Используем DOMParser для безопасного и чистого создания элемента
    // ***************************************************************************
    _template(): HTMLElement {

        // DOMParser вместо innerHTML: текст приходит с сервера
        const tpl = new DOMParser().parseFromString(`
            <div class="item flex flex-row gap-2 p-2 hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)] rounded-lg">
                <div class="cdm-avatar relative"></div>
                <div class="flex flex-col gap-0 truncate">
                    <span data-name class="font-semibold truncate"></span>
                    <span data-text class="text-xs text-secondary truncate"></span>
                    <span data-urls class="flex flex-col gap-0 text-xs"></span>
                </div>
            </div>
        `, "text/html").querySelector<HTMLElement>(".item");

        // invariant: шаблон выше всегда содержит корневой .item
        if (!tpl) throw new Error("Не удалось разобрать шаблон строки ссылки");

        return tpl;

    }

    // ***************************************************************************
    // Установка/Перерисовка данных (Private Method)
    // ***************************************************************************
    _setup(data: ChannelSectionItemData): void {

        try {

            // Сохраняем актуальные данные
            this.data = data;

            // Устанавливаем элементы
            const avatar = this.element.querySelector<HTMLElement>(":scope >.cdm-avatar");
            const name = this.element.querySelector<HTMLElement>(":scope [data-name]");
            const textPreview = this.element.querySelector<HTMLElement>(":scope [data-text]");
            const urls = this.element.querySelector<HTMLElement>(":scope [data-urls]");

            // Аватар: сервер отдаёт только имя автора — user_id/аватара в
            // выборке нет, цвет берётся от имени, а не от id сообщения
            new Avatars({
                element: avatar,
                name: data?.display_name,
                size: "md"
            });

            // Название
            if (name) name.textContent = data?.display_name ?? null;
            if (textPreview) textPreview.textContent = data?.text_preview ?? null;

            // Ссылки.
            //
            // Пересоздаём узлы и сразу же навешиваем на них обработчики:
            // отписывать старые не нужно, они уходят вместе с узлами
            if (urls) urls.textContent = "";
            this._renderUrls(urls, data?.urls);

        } catch (error) {
            Logger.error("[app][channel-profile][url-item]::setup", error);
        }

    }

    // ***************************************************************************
    // Отрисовка списка ссылок (Private Method)
    // ***************************************************************************
    _renderUrls(container: HTMLElement | null, urls?: string[] | null): void {

        // Нечего рисовать
        if (!container) return;

        // Приводим к массиву: сервер отдаёт массив, но при пустом значении
        // это может быть null
        const list = Array.isArray(urls) ? urls : [];

        for (const url of list) {

            // Пустая ссылка в разметке ломает весь блок
            if (!url || typeof url !== "string") continue;

            const link = document.createElement("a");
            link.href = url;
            link.textContent = url;

            // data-link должен быть строкой: setAttribute принимает только строки
            link.setAttribute("data-link", "true");
            link.classList.add("text-[var(--color-brand)]", "truncate", "w-fit", "cursor-pointer");

            container.append(link);

            // Слушатель вешаем здесь же — на том самом узле, который только
            // что создали. Отдельный _actions() здесь не нужен и был причиной
            // потери обработчиков после перерисовки.
            //
            // Решение «своя/чужая» принимает LinkGuard (сравнение по полному
            // origin с портом), а диалог подтверждения — наш, из форм:
            // utils не должен зависеть от форм, поэтому он передаётся колбэком
            attach(link, {
                url,
                onExternal: (href) => new MessageUrlClickConfirm({ url: href })
            });

        }

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
            const unsubscribe = this.form.urlStore.on(itemUpdatedEvent, (data) => {
                this.update(data as ChannelSectionItemData);
            });

            // Отписку снимает teardown через removeAll(): Store при очистке
            // удаляет динамические подписки элементов (utils/store.ts)
            this.data.__unsubscribeStore__ = unsubscribe;

        } catch (error) {
            Logger.error("[app][channel-profile][url-item]::subscribe", error);
        }

    }

    // ***************************************************************************
    // Геттер для удобного получения data
    // ***************************************************************************
    getData(): ChannelSectionItemData {
        return this.data;
    }

}
