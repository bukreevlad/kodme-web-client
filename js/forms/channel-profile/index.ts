// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { LocalStorage } from "../../utils/local_storage.js";
import { Store } from "../../utils/store.js";
import { toastError } from "../../utils/ui/toast_error.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Avatars } from "../../components/avatars.js";
import { Buttons } from "../../components/buttons.js";
import { Tabs } from "../../components/tabs.js";

// Импортируем config (секции вкладок)
import { MEDIA_SECTIONS } from "./config/media_sections.js";

// Импортируем handlers
import { settingsHandler } from "./handlers/settings.js";
import { onSectionScrollHandler } from "./handlers/on_section_scroll.js";

// Импортируем requests
import { getChannelInfoRequest } from "./requests/get_channel_info.js";

// Импортируем events
import { StoreEvents } from "./events/store/index.js";

// Импортируем functions
import { teardown } from "./functions/teardown.js";
import { buildSections } from "./functions/build_sections.js";

// Импортируем forms
import { Messages } from "../messages/index.js";

// Импортируем types (тип экземпляра скроллбара панели вкладки)
import type { OverlayScrollbars } from "overlayscrollbars";

// Импортируем типы
import type { ChannelProfileResponse } from "./requests/get_channel_info.js";
import type { ChannelSectionItemData, ScrollbarEntry, Unsubscribe } from "./types.js";
import { t } from "../../utils/i18n/index.js";

/**
 * Настройки формы профиля канала.
 */
export interface ChannelProfileOptions {

    /** Куда вставить форму (по умолчанию — открытый диалог или центральная колонка). */
    insertInto?: HTMLElement | null;

}

/**
 * Данные создания формы.
 */
export interface ChannelProfileData {

    /** Id канала. */
    channelId: string;

    /** Настройки формы. */
    options?: ChannelProfileOptions;

}

// Form
export class ChannelProfile {

    // Реестр всех открытых форм ChannelProfile: { channelId: instance }
    static instances = new Map<string, ChannelProfile>();

    /** Настройки формы. */
    options: ChannelProfileOptions;

    /** Корневой шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Оверлей формы (модальное окно). */
    modal: Overlay | null = null;

    /** Реестр экземпляров OverlayScrollbars панелей вкладок.
     * Нужен, чтобы teardown() разрушил их все: неразрушенный скроллбар
     * удерживает отсоединённый DOM через внутренние наблюдатели. */
    osInstances: ScrollbarEntry[] = [];

    /** Отписки от событий Store (заполняются в StoreEvents.init). */
    storeUnsubs: Unsubscribe[] = [];

    /** Отписки от слушателей скроллбаров (заполняются в _handlers). */
    handlerUnsubs: Unsubscribe[] = [];

    /** Id канала. */
    channelId: string;

    /** Объект канала с сервера (шапка профиля). */
    profile: ChannelProfileResponse | null = null;

    /** Менеджер табов формы. */
    tabs: Tabs | null = null;

    /** Контентная область формы (заполняется в _update). */
    content: HTMLElement | null = null;

    /** Аватар шапки профиля. */
    avatar: Avatars | null = null;

    /** Хранилище секции «Фото». */
    photoStore: Store<ChannelSectionItemData>;

    /** Хранилище секции «Видео». */
    videoStore: Store<ChannelSectionItemData>;

    /** Хранилище секции «Файлы». */
    fileStore: Store<ChannelSectionItemData>;

    /** Хранилище секции «Аудио». */
    audioStore: Store<ChannelSectionItemData>;

    /** Хранилище секции «Ссылки». */
    urlStore: Store<ChannelSectionItemData>;

    /** Хранилище секции «Голосовые». */
    audioNoteStore: Store<ChannelSectionItemData>;

    /** Списки вкладок (контейнеры, куда кладутся строки медиа).
     * Объявляются здесь, а не как побочный эффект в _onBeforeOpen: иначе
     * до момента сборки вкладок свойство не существует, и обращение
     * к нему падало бы с undefined вместо null. */
    listPhotos: HTMLElement | null = null;
    listVideos: HTMLElement | null = null;
    listFiles: HTMLElement | null = null;
    listUrls: HTMLElement | null = null;
    listAudioNotes: HTMLElement | null = null;
    listAudios: HTMLElement | null = null;

    /** Экземпляры OverlayScrollbars панелей вкладок: их создаёт
     * functions/register_scrollbar.ts и разрушает teardown(). Поля
     * объявлены, чтобы обработчики скролла читали их по ключу секции
     * (section.scrollKey) без кастов. */
    osListPhotosScrollInstance: OverlayScrollbars | null = null;
    osListVideosScrollInstance: OverlayScrollbars | null = null;
    osListFilesScrollInstance: OverlayScrollbars | null = null;
    osListUrlsScrollInstance: OverlayScrollbars | null = null;
    osListVoicesScrollInstance: OverlayScrollbars | null = null;
    osListAudiosScrollInstance: OverlayScrollbars | null = null;

    /** Динамическое состояние пагинации секций (FirstLoaded, LoadingFirst/
     * Prev/Next, HasMorePrev/Next, CursorMin/Max, ErrorToastAt, ScrollManager,
     * Empty). Ключи выводятся из section.id в functions/load_section.ts,
     * поэтому перечислять их здесь невозможно. Неинициализированное состояние —
     * undefined, что для всех проверок эквивалентно «не загружено». */
    [key: string]: unknown;

    /**
     * ***************************************************************************
     * Форма.
     * @param data - Данные (id канала и настройки формы).
     * ***************************************************************************
     */
    constructor(data: ChannelProfileData) {

        // Если не передан channelId
        if (!data?.channelId) throw new Error("Не передан: channelId");

        // Поиск открытого окна сообщений
        const messagesForm = Messages.instances.get(data.channelId);
        const insertInto = messagesForm?.modal?.content || document.querySelector<HTMLElement>(".cdm-form.home .middle >.form-container");

        // Устанавливаем настройки
        this.options = {
            insertInto,
            ...data?.options
        };

        // Переменные формы
        this.channelId = data.channelId;

        // Хранилища
        this.photoStore = new Store<ChannelSectionItemData>();
        this.videoStore = new Store<ChannelSectionItemData>();
        this.fileStore = new Store<ChannelSectionItemData>();
        this.audioStore = new Store<ChannelSectionItemData>();
        this.urlStore = new Store<ChannelSectionItemData>();
        this.audioNoteStore = new Store<ChannelSectionItemData>();

        // Получаем instance
        const instance = ChannelProfile.instances.get(data.channelId);
        if (instance) return instance;

        // Регистрируем этот экземпляр формы
        ChannelProfile.instances.set(this.channelId, this);

        // Инициализация
        this._init();

    }

    // ***************************************************************************
    // Инициализация
    // ***************************************************************************
    async _init(): Promise<void> {

        // Подписываемся на события Store.
        StoreEvents.init(this);

        // Открытие
        await this._open();

    }

    // ***************************************************************************
    // Открытие
    // ***************************************************************************
    async _open(): Promise<void> {

        try {

            // Шаблон формы
            this.tpl = this._template();

            // Шапка свайпа: узел может отсутствовать — в таком случае
            // игнорировать нечего
            const tabsElement = this.tpl.querySelector<HTMLElement>(":scope >.content [data-tabs]");

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "form",
                url: `?channel-profile=${this.channelId}`,
                insertInto: this.options.insertInto,
                closeOnEsc: true,
                closeOnOverlay: true,
                ignoreSwipeElements: tabsElement ? [tabsElement] : [],
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: () => this._onOpen(),
                onBeforeClose: () => this._onBeforeClose(),
            });

            // Открываем форму
            this.modal.open();

        } catch (error) {

            Logger.error(error);

            // Форма не создалась, значит close() не вызовется и подписки
            // останутся в памяти — освобождаем их явно
            teardown(this);

            // Убираем форму из реестра, чтобы повторное открытие создало новую
            ChannelProfile.instances.delete(this.channelId);

        }

    }

    // ***************************************************************************
    // Обработчики
    // ***************************************************************************
    _handlers(): void {

        try {

            // Обработчики вешаются на узлы шаблона — без него нечего слушать
            if (!this.tpl) return;

            // Закрыть
            const close = this.tpl.querySelector(":scope >.header [action-close]");
            close?.addEventListener("click", () => this.modal?.close());

            // Настройки
            const settings = this.tpl.querySelector(":scope >.header [action-settings]");
            settings?.addEventListener("click", () => settingsHandler(this));

            // =========================

            // Догрузка соседних страниц при скролле каждой вкладки.
            // Раньше здесь стояло шесть одинаковых подписок; теперь одна
            // функция в цикле по конфигу секций.
            //
            // Отписку кладём в this.handlerUnsubs, а не в storeUnsubs:
            // это не подписки на Store, а слушатели OverlayScrollbars,
            // и снимать их нужно вместе со скроллбарами в teardown.
            // Сам onSectionScrollHandler уже троттлит проверку и отменяет
            // отложенный вызов при отписке
            this.handlerUnsubs = [];

            for (const section of MEDIA_SECTIONS) {

                const unsubscribe = onSectionScrollHandler(this, section, this[section.scrollKey]);
                if (unsubscribe) this.handlerUnsubs.push(unsubscribe);

            }

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Настройка формы
    // ***************************************************************************
    async _onBeforeOpen(): Promise<boolean | undefined> {

        // Шапка профиля — то, без чего форма бессмысленна. Если её не удалось
        // получить, открывать нечего: показываем тост и отказываемся открываться.
        // Отказ делается возвратом false — Overlay вызывает close(), а тот в свою
        // очередь onBeforeClose(), то есть teardown отработает штатно.
        let profileData: ChannelProfileResponse;
        try {

            const response = await getChannelInfoRequest({ channel_id: this.channelId });

            if (!response?.data) throw new Error("Пустой ответ сервера");

            profileData = response.data;

        } catch (error) {

            // Пользователь должен понять, что произошло. Раньше ошибка уходила
            // в лог, а форма открывалась пустой: без аватара, имени и табов
            toastError(error, {
                context: "[app][channel-profile][get-info]",
                fallback: t("forms.channel_profile.toasts.load_error")
            });

            return false;

        }

        try {

            // Записываем tab контейнер
            const links = this.tpl?.querySelector<HTMLElement>(":scope >.content [data-tabs-list]");
            const panes = this.tpl?.querySelector<HTMLElement>(":scope >.content .cdm-tabs-content");

            // Узлы вкладок обязаны быть в шаблоне — иначе как в легаси
            // отказываемся открываться через общий catch
            if (!links || !panes) throw new Error("[channel-profile]: не найдены узлы вкладок");

            this.tabs = new Tabs([
                { tabs: links, scrollType: "horizontal" }
            ], panes, { isSlider: false });

            // Собираем все вкладки разом по конфигу секций. Раньше здесь стояло
            // шесть одинаковых блоков по ~25 строк; логика и шаблоны ушли в
            // functions/build_sections.ts, описание вкладок — в
            // config/media_sections.ts
            buildSections(this, MEDIA_SECTIONS);

            // Активируем первую вкладку. Именно здесь, а не до сборки:
            // Tabs должен видеть все панели, чтобы корректно найти активную.
            // Активация вызывает onActivation секции — она и грузит первую страницу
            const firstSection = MEDIA_SECTIONS[0];
            if (firstSection) this.tabs.activateTab(firstSection.id);

            // Обновляем данные формы
            this._update(profileData);

        } catch (error) {

            // Ошибка уже после успешного запроса: значит проблема в сборке
            // вкладок, а не в сети. Показываем тост и не открываем форму —
            // иначе пользователь увидит пустое окно без объяснений
            Logger.error("[app][channel-profile][before-open]::build-tabs", error);
            toastError(error, {
                context: "[app][channel-profile][before-open]",
                fallback: t("forms.channel_profile.toasts.load_error")
            });

            return false;

        }

    }

    // ***************************************************************************
    // Форма открылась
    // ***************************************************************************
    _onOpen(): void {

        this._handlers();

        // Первую страницу первой вкладки здесь НЕ грузим: activateTab() в
        // _onBeforeOpen уже вызывает onActivation секции, а тот — loadSection.
        // Дубль дедуплицировался только флагом загрузки, который снимается
        // в finally: если первый запрос успевал завершиться (в том числе
        // с ошибкой), уходил лишний повторный запрос.

    }

    // ***************************************************************************
    // Обновление данных формы
    //
    // Публичный метод: работает с уже открытой формой и вызывается из
    // подписки на обновление канала в Main.store.
    //
    // Почему обёртка нужна: Store.emit не изолирует слушателей (utils/store.ts),
    // поэтому исключение отсюда прервало бы эмиссию для всех остальных
    // подписчиков этого события, то есть сломало бы чужой код.
    // ***************************************************************************
    update(data?: ChannelProfileResponse): void {

        // Store.update() эмитит событие даже если элемента нет в Map —
        // в этом случае data === undefined
        if (!data) return;

        try {
            this._update(data);
        } catch (error) {
            Logger.error("[app][channel-profile][update]::", error);
        }

    }

    // ***************************************************************************
    // Применение данных к DOM (Private Method)
    // ***************************************************************************
    async _update(data: ChannelProfileResponse): Promise<void> {

        // Данные
        this.profile = data;

        // Без шаблона заполнять нечего
        if (!this.tpl) return;

        // Устанавливаем элементы
        this.content = this.tpl.querySelector<HTMLElement>(":scope >.content");
        const settings = this.tpl.querySelector<HTMLElement>(":scope >.header >[action-settings]");
        const avatar = this.tpl.querySelector<HTMLElement>(":scope >.content .cdm-avatar");
        const name = this.tpl.querySelector<HTMLElement>(":scope >.content [data-name]");
        const link = this.tpl.querySelector<HTMLElement>(":scope >.content [data-link]");
        const about = this.tpl.querySelector<HTMLElement>(":scope >.content [data-about]");

        // Поля обязаны входить в шаблон — иначе заполнять нечего
        if (!settings || !name || !link || !about) return;

        // Определяем id аватара (у диалога/избранного id берём от собеседника)
        let avatarId: string | undefined = this.profile.id;

        // Если это диалог
        if ([1, 8].includes(this.profile.type)) {
            avatarId = this.profile.display_user_id;
        }

        // Аватар
        this.avatar = new Avatars({
            element: avatar,
            id: avatarId,
            name: this.profile.display_name,
            image: this.profile?.avatar,
            size: "3xl",
            wrapClasses: [this.profile?.type === 2 ? "rounded-xl" : "rounded-full"]
        });

        // Если это избранное
        if (this.profile.type === 5) {
            this.avatar.setIcon("bookmark");
        }

        // Записываем данные (поля профиля опциональны — нормализуем, чтобы
        // в поле не «утекало» undefined)
        name.textContent = this.profile.display_name ?? null;
        link.textContent = this.profile.link ?? null;
        about.textContent = this.profile.about ?? null;

        // invariant: сессия создаётся при логине — у неё всегда есть user с id
        const sessionUser = LocalStorage.session?.user as { id?: string } | null;

        // Если это не автор
        if (sessionUser?.id !== this.profile.created_user_id) {
            settings.classList.add("hidden");
        }

        // Если это не канал, группа или тема
        if (![2, 3, 4].includes(this.profile.type)) {
            settings.classList.add("hidden");
        }

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Освобождаем ресурсы: отписки Store, скроллбары, хранилища.
        // Функция общая с путём отказа открытия — иначе неоткрывшаяся
        // форма оставляла бы подписки в памяти
        teardown(this);

        // Убираем форму из реестра, чтобы повторное открытие создало новую
        ChannelProfile.instances.delete(this.channelId);

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement {

        const tpl = new DOMParser().parseFromString(`
        
            <div class="cdm-form channel-profile flex flex-col gap-0 w-full ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "ArrowLeft" })}
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-settings"], icon: "Settings" })}
                </div>
                 <div class="content w-full h-full flex flex-col gap-0 max-w-[var(--form-max-content-width)] m-auto overflow-hidden ${CDM_FORM_CONTENT_CLASSES()}">

                    <div class="flex flex-col p-3 gap-3">
                        <div class="flex flex-col gap-3 p-3 py-4 items-center">
                            <div class="cdm-avatar relative"></div>
                            <div class="flex flex-col gap-1 items-center">
                                <span data-name class="font-semibold"></span>
                                <span data-link class="empty:hidden text-[var(--color-brand)] dark:text-[var(--color-brand)] font-mono"></span>
                                <span data-about class="empty:hidden text-muted text-sm text-center"></span>
                            </div>
                        </div>
                    </div>

                    <div class="flex flex-col p-3 gap-3">
                        <div data-tabs class="p-1 w-full relative bg-[var(--second-bg)] rounded-3xl overflow-hidden">
                            <div data-tabs-list class="cdm-tabs flex flex-row gap-1 w-full rounded-3xl overflow-x-auto scrollbar-none"></div>
                        </div>
                    </div>

                    <!--
                        is-slider здесь раньше стоял статически, хотя Tabs создавался
                        с { isSlider: false }. Класс задаёт position/overflow и анимации
                        слайдера, которые при isSlider: false никогда не включаются: JS
                        не вешает классы slide-*, поэтому анимации не запускаются.
                        Панели скрывались только потому, что правило
                        '.cdm-tabs-content > .item:not(.active)' в css/components/tabs.css
                        и не зависит от is-slider.
                        Нужные слайдеру свойства перечислены явно (relative/overflow-hidden),
                        ширина панелей — классом w-full в шаблонах панелей.
                    -->
                    <div class="cdm-tabs-content relative overflow-hidden flex w-full p-3"></div>
                    
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

        // invariant: шаблон выше всегда содержит корневой .cdm-form
        if (!tpl) throw new Error("Не удалось разобрать шаблон формы профиля канала");

        return tpl;

    }

}
