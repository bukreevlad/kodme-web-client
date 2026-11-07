// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES, CDM_FORM_SECTION_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Icons } from "../../utils/icons.js";
import { Store } from "../../utils/store.js";

// Импортируем core
import { ScrollManager } from "../../core/managers/scroll_manager.js";

// Импортируем functions
import { getDevices } from "./functions/get_devices.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";

// Импортируем events
import { subscribeStoreEvents } from "./events/store/store_events.js";

// Импортируем handlers
import { removeAllOtherDevicesHandler } from "./handlers/remove_other_devices.js";
import { onDevicesScrollHandler } from "./handlers/on_devices_scroll.js";

// Импортируем forms
import { UserProfile } from "../user-profile/index.js";
import { UserSettingLoginWithQRCode } from "../user-setting-login-qrcode/index.js";

// Импортируем типы
import type { SessionListItem } from "./types.js";

/**
 * Настройки формы устройств.
 */
export interface UserSettingDevicesOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные конструктора формы.
 */
export interface UserSettingDevicesData {

    /** Id пользователя. */
    userId: string;

    /** Настройки формы. */
    options?: UserSettingDevicesOptions;

}

// Form
export class UserSettingDevices {

    // Переменная для хранения единственного экземпляра формы
    static instance: UserSettingDevices | null = null;

    /** Настройки формы. */
    options: UserSettingDevicesOptions;

    /** Id пользователя. */
    userId: string;

    // Каркас: шаблон, модалка, контент
    tpl: HTMLElement | null = null;
    modal: Overlay | null = null;
    content: HTMLElement | null = null;

    // Элементы списка, текущего устройства и заглушки
    list: HTMLElement | null = null;
    currentDevice: HTMLElement | null = null;
    devicesEmpty: HTMLElement | null = null;

    // Скролл-инстанс и менеджер якоря
    osListScrollInstance: OverlayScrollbars | null = null;
    listScrollManager: ScrollManager | null = null;

    // Отписка от скролла списка
    _offScrollDevices: (() => void) | null = null;

    // Состояние пагинации списка (см. functions/get_devices.ts)
    isFirstLoaded: boolean;
    isLoadingFirst: boolean;
    isLoadingPrev: boolean;
    isLoadingNext: boolean;
    hasMorePrev: boolean;
    hasMoreNext: boolean;
    lastErrorToastAt: number;

    // Хранилище списка сессий
    store: Store<SessionListItem>;

    /**
     * ***************************************************************************
     * Форма.
     * @param data - Данные.
     * @param data.userId - Id пользователя.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: UserSettingDevicesData) {

        // Если не передан userId
        if (!data?.userId) throw new Error("Не передан: userId");

        // Поиск открытого профиля пользователя
        let userProfileForm = UserProfile.instances.get(data.userId);
        let insertInto = userProfileForm?.modal?.content || null;

        // Устанавливаем настройки
        this.options = {
            insertInto,
            ...data?.options
        }

        // Переменные формы
        this.userId = data.userId;

        // Состояние пагинации списка
        this.isFirstLoaded = false; // первая страница загружена
        this.isLoadingFirst = false; // первая страница грузится
        this.isLoadingPrev = false; // грузится пачка старых (вверх)
        this.isLoadingNext = false; // грузится пачка новых (вниз)
        this.hasMorePrev = true; // есть ли старые сессии выше списка
        this.hasMoreNext = true; // есть ли новые сессии ниже списка
        this.lastErrorToastAt = 0; // время последнего тоста ошибки (троттлинг)

        // Хранилище списка сессий
        this.store = new Store<SessionListItem>();

        // Проверяем, существует ли уже экземпляр
        if (UserSettingDevices.instance) {
            return UserSettingDevices.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        UserSettingDevices.instance = this;

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
                url: `?user-setting-devices=${this.userId}`,
                insertInto: this.options.insertInto,
                closeOnEsc: false,
                closeOnOverlay: false,
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: () => this._onOpen(),
                onBeforeClose: () => this._onBeforeClose()
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
            let close = this.tpl.querySelector(`:scope >.header [action-close]`);
            close?.addEventListener("click", () => this.modal?.close());

            // Вход по qr коду
            let loginWithQRCode = this.tpl.querySelector(`:scope >.header [action-login-with-qrcode]`);
            loginWithQRCode?.addEventListener("click", () => new UserSettingLoginWithQRCode({ userId: this.userId }));

            // Удалить все сессии кроме текущей
            let removeAllOtherDevices = this.tpl.querySelector(`:scope >.content [action-remove-all-other-devices]`);
            removeAllOtherDevices?.addEventListener("click", () => removeAllOtherDevicesHandler(this));

            // =========================

            // При скролле списка: троттлинг, проверка краёв и защита от
            // параллельных запросов — внутри хендлера
            this._offScrollDevices = onDevicesScrollHandler(this, this.osListScrollInstance);

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

            // Устанавливаем список
            this.content = this.tpl.querySelector(":scope >.content");
            this.list = this.tpl.querySelector(":scope >.content [data-devices]");
            this.currentDevice = this.tpl.querySelector(`:scope >.content [data-current-device]`);
            this.devicesEmpty = this.tpl.querySelector(`:scope >.content [data-devices-empty]`);

            // Инициализируем скроллбар (скролл-контейнер входит в шаблон)
            const content = this.content;
            if (content) {
                this.osListScrollInstance = OverlayScrollbars(content, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
            }

            // Менеджер якоря скролла: вставка пачки в начало списка
            // сдвигала бы видимую часть вниз (см. functions/get_devices.ts)
            if (this.osListScrollInstance) {
                this.listScrollManager = new ScrollManager(this.osListScrollInstance);
            }

            // Получаем сессии (заглушку «Других активных сессий нет»
            // переключает functions/update_empty_state.ts)
            await getDevices(this);

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

        // Снимаем подписку на скролл (внутри — отписка и cancel троттлинга)
        this._offScrollDevices?.();
        this._offScrollDevices = null;

        // Удаляем экземпляр формы
        UserSettingDevices.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement {

        return new DOMParser().parseFromString(`

            <div class="cdm-form user-setting-devices flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.create({
            intent: "transparent",
            shape: "circle",
            attributes: ["action-close"],
            icon: "ArrowLeft"
        })}
                    <span class="font-semibold text-base truncate">${window._lc.forms.user_settings.devices}</span>
                    ${Buttons.create({
            attributes: ["action-login-with-qrcode"],
            text: window._lc.forms.user_setting_devices.login_qr_code,
            icon: "qrcode"
        })}
                </div>
                <div class="content w-full h-full flex ${CDM_FORM_CONTENT_CLASSES()}">

                    <div class="flex flex-col gap-3 p-3 max-w-[var(--form-max-content-width)] m-auto w-full">

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <div class="flex flex-row items-center gap-2">
                                <div class="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("device-desktop", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </div>
                                <span class="font-semibold">${window._lc.forms.user_setting_devices.current_device}</span>
                            </div>
                            <div data-current-device class="flex flex-col gap-2"></div>
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <div class="flex flex-row items-center gap-2">
                                <div class="flex items-center justify-center w-8 h-8">
                                    ${Icons.icon("devices", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </div>
                                <span class="font-semibold">${window._lc.forms.user_setting_devices.active_sessions}</span>
                            </div>
                            <span data-devices-empty class="hidden text-sm text-muted text-center">${window._lc.forms.user_setting_devices.no_sessions}</span>
                            <div data-devices class="flex flex-col gap-2"></div>
                            ${Buttons.danger({
            shape: "square",
            classes: ["w-full"],
            attributes: ["action-remove-all-other-devices"],
            icon: "logout-2",
            text: window._lc.forms.user_setting_devices.remove_all_other_devices
        })}
                        </div>

                    </div>

                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form")!;

    }

}
