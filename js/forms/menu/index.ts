// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES } from "../../config/constants.js";

// Импортируем config
import { slideInLeft } from "../../config/animations.js";
import { slideOutLeft } from "../../config/animations.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { LocalStorage } from "../../utils/local_storage.js";
import { Store } from "../../utils/store.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Avatars } from "../../components/avatars.js";
import { Buttons } from "../../components/buttons.js";

// Импортируем events
import { subscribeStoreEvents } from "./events/store/store_events.js";

// Импортируем handlers
import { profileHandler } from "./handlers/profile.js";
import { switchColorSchemeHandler } from "./handlers/switch_color_scheme.js";
import { createChannelHandler } from "./handlers/create_channel.js";
import { createGroupHandler } from "./handlers/create_group.js";
import { contactsHandler } from "./handlers/contacts.js";
import { castsHandler } from "./handlers/casts.js";
import { meetsHandler } from "./handlers/meets.js";
import { themesHandler } from "./handlers/themes.js";
import { cloudHandler } from "./handlers/cloud.js";
import { stickersHandler } from "./handlers/stickers.js";

// Импортируем типы
import type { MenuSessionItem, SessionProfile } from "./types.js";

/**
 * Настройки формы меню.
 */
export interface MenuOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

// Form
export class Menu {

    // Переменная для хранения единственного экземпляра формы
    static instance: Menu | null = null;

    /** Настройки формы. */
    options: MenuOptions;

    // Каркас: шаблон, модалка, элементы
    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальный оверлей меню. */
    modal: Overlay | null = null;

    /** Скроллбар контента списка сессий. */
    osListScrollInstance: OverlayScrollbars | null = null;

    /** Хранилище списка сессий. */
    store: Store<MenuSessionItem>;

    /** Контент формы (скроллится через OverlayScrollbars). */
    content: HTMLElement | null = null;

    /** Список строк сессий. */
    list: HTMLElement | null = null;

    /**
     * ***************************************************************************
     * Форма.
     * @param options - Настройки формы.
     * ***************************************************************************
     */
    constructor(options?: MenuOptions) {

        // Устанавливаем настройки
        this.options = {
            insertInto: document.querySelector<HTMLElement>(".cdm-form.home .left"),
            ...options
        }

        // Переменные формы
        this.tpl = null;
        this.modal = null;
        this.osListScrollInstance = null; // overlayScroll instance

        // Хранилище списка сессий
        this.store = new Store<MenuSessionItem>();

        // Проверяем, существует ли уже экземпляр
        if (Menu.instance) {
            return Menu.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        Menu.instance = this;

        // Инициализация
        this._init();

    }

    // ***************************************************************************
    // Инициализация
    // ***************************************************************************
    async _init(): Promise<void> {

        // Подписываемся на события Store.
        subscribeStoreEvents(this);

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

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "form",
                url: `?menu`,
                insertInto: this.options.insertInto,
                closeOnOverlay: true,
                closeOnSwipe: { direction: "left" },
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: () => this._onOpen(),
                onBeforeClose: () => this._onBeforeClose(),
                notReplaceAnimationClassIsMobile: true,
                openAnimationClass: slideInLeft,
                closeAnimationClass: slideOutLeft
            });

            // Открываем форму
            this.modal.open();

        } catch (error) {
            Logger.error(error);
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

            // Сменить цветовую схему
            const switchColorScheme = this.tpl.querySelector(":scope >.header [action-swith-color-scheme]");
            switchColorScheme?.addEventListener("click", () => switchColorSchemeHandler(this));

            // Профиль
            const profile = this.tpl.querySelector(":scope >.content [action-profile]");
            profile?.addEventListener("click", () => profileHandler(this));

            // Создать сообщество
            const createChannel = this.tpl.querySelector(":scope >.content [action-create-channel]");
            createChannel?.addEventListener("click", () => createChannelHandler(this));

            // Создать группу
            const createGroup = this.tpl.querySelector(":scope >.content [action-create-group]");
            createGroup?.addEventListener("click", () => createGroupHandler(this));

            // Контакты
            const contacts = this.tpl.querySelector(":scope >.content [action-contacts]");
            contacts?.addEventListener("click", () => contactsHandler(this));

            // Трансляции
            const casts = this.tpl.querySelector(":scope >.content [action-casts]");
            casts?.addEventListener("click", () => castsHandler(this));

            // Конференции
            const meets = this.tpl.querySelector(":scope >.content [action-meets]");
            meets?.addEventListener("click", () => meetsHandler(this));

            // Темы
            const themes = this.tpl.querySelector(":scope >.content [action-themes]");
            themes?.addEventListener("click", () => themesHandler(this));

            // Облако
            const cloud = this.tpl.querySelector(":scope >.content [action-cloud]");
            cloud?.addEventListener("click", () => cloudHandler(this));

            // Стикеры
            const stickers = this.tpl.querySelector(":scope >.content [action-stickers]");
            stickers?.addEventListener("click", () => stickersHandler(this));

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Настройка формы
    // ***************************************************************************
    async _onBeforeOpen(): Promise<void> {

        try {

            // Элементы заполняются из шаблона — без него нечего настраивать
            if (!this.tpl) return;

            // Устанавливаем элементы
            this.content = this.tpl.querySelector<HTMLElement>(":scope >.content");
            this.list = this.tpl.querySelector<HTMLElement>("[data-sessions-list]");

            // Устанавливаем элементы
            const avatar = this.tpl.querySelector<HTMLElement>(":scope >.content .cdm-avatar");
            const name = this.tpl.querySelector<HTMLElement>(":scope >.content [data-name]");
            const link = this.tpl.querySelector<HTMLElement>(":scope >.content [data-link]");
            const bio = this.tpl.querySelector<HTMLElement>(":scope >.content [data-bio]");

            // Поля обязаны входить в шаблон — иначе заполнять нечего
            if (!name || !link || !bio) return;

            // Текущая сессия (без неё профиль не заполнить)
            const session = LocalStorage.session;
            if (!session) return;

            // invariant: профиль текущей сессии приходит с сервера в
            // фиксированном виде { id, display_name, link, bio, avatar }
            // (см. ответ auth/check и сохранение сессии) — читаем поля
            // этим сужением unknown
            const user = session.user as SessionProfile;

            // Аватар
            Avatars.create({
                element: avatar,
                id: user.id,
                name: user.display_name,
                image: user.avatar,
                size: "2xl"
            });

            // Записываем данные (display_name/link/bio опциональны —
            // нормализуем, чтобы в поле не «утекало» undefined)
            name.textContent = user.display_name ?? null;
            link.textContent = user.link ?? null;
            bio.textContent = user.bio ?? null;

            // Сессии
            const sessions = LocalStorage.getAllSessions();

            // Проходим по сессиям
            sessions.forEach(session => {
                if (session.id !== LocalStorage.sessionId) {
                    this.store.add(session);
                }
            });

            // Инициализируем элементы
            const content = this.content;
            if (content) {
                this.osListScrollInstance = OverlayScrollbars(content, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
            }

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Форма открылась
    // ***************************************************************************
    _onOpen(): void {

        this._handlers();

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Удаляем экземпляр формы
        Menu.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement {

        // invariant: корневой .cdm-form входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`
        
            <div class="cdm-form menu flex flex-col gap-0 ${CDM_FORM_CLASSES()} shadow-lg w-[75%] max-w-[75%]">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.circle({ intent: "transparent", attributes: ["action-close"], icon: "ArrowLeft" })}
                    ${Buttons.circle({ intent: "transparent", attributes: ["action-swith-color-scheme"], icon: "Moon" })}
                </div>
                 <div class="content w-full h-full flex flex-col gap-3 ${CDM_FORM_CONTENT_CLASSES()}">

                    <div class="flex flex-col gap-3 p-3 py-4 items-center">
                        <div class="cdm-avatar relative"></div>
                        <div class="flex flex-col gap-0 items-center text-center">
                            <span data-name class="font-semibold text-lg"></span>
                            <span data-link class="empty:hidden text-[var(--color-brand)] dark:text-[var(--color-brand)] font-mono"></span>
                            <span data-bio class="empty:hidden text-muted font-mono text-sm"></span>
                        </div>
                    </div>

                    <div data-sessions-list class="flex flex-col gap-0 p-3 pb-0 empty:hidden"></div>

                    <div class="flex flex-col gap-0 p-3">
                        ${Buttons.transparent({ attributes: ["action-profile"], classes: ["justify-start"], text: "Мой профиль", icon: "user-cog" })}
                        ${Buttons.transparent({ attributes: ["action-create-channel"], classes: ["justify-start"], text: "Создать сообщество", icon: "FolderPlus" })}
                        ${Buttons.transparent({ attributes: ["action-create-group"], classes: ["justify-start"], text: "Создать группу", icon: "MessageCirclePlus" })}
                        ${Buttons.transparent({ attributes: ["action-contacts"], classes: ["justify-start"], text: "Контакты", icon: "address-book" })}
                        ${Buttons.transparent({ attributes: ["action-casts"], classes: ["justify-start"], text: "Трансляции", icon: "player-play" })}
                        ${Buttons.transparent({ attributes: ["action-meets"], classes: ["justify-start"], text: "Конференции", icon: "Headset" })}
                        ${Buttons.transparent({ attributes: ["action-cloud"], classes: ["justify-start"], text: "Облако", icon: "Folder" })}
                        ${Buttons.transparent({ attributes: ["action-themes"], classes: ["justify-start"], text: "Темы", icon: "Palette" })}
                        ${Buttons.transparent({ attributes: ["action-stickers"], classes: ["justify-start"], text: "Стикеры", icon: "Sticker" })}
                    </div>

                    <div class="p-3">
                        <span data-version class="text-muted text-sm">Версия сборки: __BUILD_VERSION__</span>
                    </div>
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form")!;

    }

}
