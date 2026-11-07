// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES, CDM_FORM_SECTION_CLASSES, CHAT_BACKGROUNDS, BRAND_COLORS } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { LocalStorage } from "../../utils/local_storage.js";
import { Icons } from "../../utils/icons.js";
import { Store } from "../../utils/store.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { Toggle } from "../../components/toggle.js";

// Импортируем components формы
import { createBrandColorItem } from "./components/brand_color.js";

// Импортируем functions формы
import { INTERFACE_SIZE_STEPS, MESSAGE_SIZE_STEPS, nearestSizeStep } from "./functions/size_steps.js";

// Импортируем handlers
import { interfaceSizeHandler } from "./handlers/interface_size.js";
import { messageTextSizeHandler } from "./handlers/message_text_size.js";
import { colorSchemeHandler } from "./handlers/color_scheme.js";
import { isChatBackgroundsHandler } from "./handlers/is_chat_backgrounds.js";
import { resetThemeHandler } from "./handlers/reset_theme.js";
import { isBlurHandler } from "./handlers/is_blur.js";
import { brandColorHandler } from "./handlers/brand_color.js";
import { uiRadiusHandler } from "./handlers/ui_radius.js";

// Импортируем forms
import { UserProfile } from "../user-profile/index.js";

// Импортируем events
import { subscribeStoreEvents } from "./events/store/store_events.js";

/**
 * Настройки формы оформления.
 */
export interface UserSettingDecorationsOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные конструктора формы.
 */
export interface UserSettingDecorationsData {

    /** Id пользователя. */
    userId: string;

    /** Настройки формы. */
    options?: UserSettingDecorationsOptions;

}

// Form
export class UserSettingDecorations {

    // Переменная для хранения единственного экземпляра формы
    static instance: UserSettingDecorations | null = null;

    /** Настройки формы. */
    options: UserSettingDecorationsOptions;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Контент формы (скролл-контейнер OverlayScrollbars). */
    content: HTMLElement | null = null;

    /** Инстанс OverlayScrollbars списка. */
    osListScrollInstance: OverlayScrollbars | null = null;

    /** Список фонов чатов (хранилище). */
    store: Store = new Store();

    /** Контейнер списка фонов в DOM. */
    backgroundList: HTMLElement | null = null;

    /** Id пользователя. */
    userId: string;

    /**
     * ***************************************************************************
     * Форма.
     * @param data - Данные.
     * @param data.userId - Id пользователя.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: UserSettingDecorationsData) {

        // Если не передан userId
        if (!data?.userId) throw new Error("Не передан: userId");

        // Поиск открытого профиля пользователя
        const userProfileForm = UserProfile.instances.get(data.userId);
        const insertInto = userProfileForm?.modal?.content || null;

        // Устанавливаем настройки
        this.options = {
            insertInto,
            ...data?.options
        }

        // Переменные формы
        this.userId = data.userId;

        // Проверяем, существует ли уже экземпляр
        if (UserSettingDecorations.instance) {
            return UserSettingDecorations.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        UserSettingDecorations.instance = this;

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

            if (!this.tpl) return;

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "form",
                url: `?user-setting-decoration=${this.userId}`,
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

            // Шаблон и модалка создаются в _open: без них обрабатывать нечего
            if (!this.tpl || !this.modal) return;

            // Закрыть
            const close = this.tpl.querySelector(`:scope >.header [action-close]`);
            close?.addEventListener("click", () => this.modal?.close());

            // Размер интерфейса. Карточки размера — радиогруппа: событие
            // change вешается на неё целиком (querySelectorAll), превью
            // обновляется сразу после применения
            const interfaceSize = this.tpl.querySelectorAll(`:scope >.content [name="interface-size"]`);
            interfaceSize.forEach(input => input?.addEventListener("change", () => {
                interfaceSizeHandler(this);
                this._updatePreviews();
            }));

            // Размер текста сообщений (та же схема, что и у интерфейса)
            const messageTextSize = this.tpl.querySelectorAll(`:scope >.content [name="message-text-size"]`);
            messageTextSize.forEach(input => input?.addEventListener("change", () => {
                messageTextSizeHandler(this);
                this._updatePreviews();
            }));

            // Цветовая схема
            const colorScheme = this.tpl.querySelectorAll(`:scope >.content [name="color-scheme"]`);
            colorScheme.forEach(schema => schema?.addEventListener("change", () => colorSchemeHandler(this)));

            // Сбросить тему
            const resetTheme = this.tpl.querySelector(`:scope >.content [action-reset-theme]`);
            resetTheme?.addEventListener("click", () => resetThemeHandler(this));

            // Фоны чата
            const isChatBackgrounds = this.tpl.querySelector(`:scope >.content [name="is-chat-background-enabled"]`);
            isChatBackgrounds?.addEventListener("change", () => isChatBackgroundsHandler(this));

            // Размытие
            const isBlur = this.tpl.querySelector(`:scope >.content [name="is-blur-enabled"]`);
            isBlur?.addEventListener("change", () => isBlurHandler(this));

            // Акцентный цвет: свой вариант
            const customBrandColor = this.tpl.querySelector<HTMLInputElement>(`:scope >.content [name="brand-color-custom"]`);
            customBrandColor?.addEventListener("change", () => brandColorHandler(this, { id: "custom", color: customBrandColor.value }));

            // Скругление интерфейса
            const uiRadius = this.tpl.querySelectorAll(`:scope >.content [name="ui-radius"]`);
            uiRadius.forEach(radius => radius?.addEventListener("change", () => uiRadiusHandler(this)));

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Настройка формы
    // ***************************************************************************
    async _onBeforeOpen(): Promise<void> {

        try {

            // Текущая сессия: без неё настройки декораций не читаются
            // (легаси здесь же падал с TypeError)
            const session = LocalStorage.session;
            if (!session) return;

            // Шаблон создаётся в _open
            if (!this.tpl) return;

            // Устанавливаем элементы
            this.content = this.tpl.querySelector(":scope >.content");
            const interfaceSize = this.tpl.querySelector<HTMLInputElement>(`:scope >.content [name="interface-size"]`);
            const messageTextSize = this.tpl.querySelector<HTMLInputElement>(`:scope >.content [name="message-text-size"]`);
            const currentThemeName = this.tpl.querySelector<HTMLElement>(`:scope >.content [data-current-theme]`);
            const colorScheme = this.tpl.querySelector<HTMLElement>(`:scope >.content [name="color-scheme"][value="${session?.settings?.user?.themes?.color_scheme || "system"}"]`);
            const isChatBackgrounds = this.tpl.querySelector<HTMLElement>(`:scope >.content [name="is-chat-background-enabled"]`);
            const isBlur = this.tpl.querySelector<HTMLElement>(`:scope >.content [name="is-blur-enabled"]`);
            this.backgroundList = this.tpl.querySelector(`:scope >.content [data-list-chat-backgrounds]`);

            // Узлы разметки обязательны для гидратации формы
            if (!this.content || !interfaceSize || !messageTextSize || !currentThemeName || !colorScheme || !isChatBackgrounds || !isBlur) return;

            // Выбираем сохранённый шаг радиогруппы. Значения в сессии —
            // строки-коэффициенты; старые значения вне списка шагов (например,
            // 1.1875 = 19px из прежнего диапазона 13–19) прилипают к ближайшему
            // варианту и попадут в сессию только после нового выбора пользователя
            const savedInterfaceSize = Number(session.settings.user.decorations.interface_size || 0.875);
            const savedMessageSize = Number(session.settings.user.decorations.message_text_size || 1);
            const interfaceStep = nearestSizeStep(INTERFACE_SIZE_STEPS, savedInterfaceSize);
            const messageStep = nearestSizeStep(MESSAGE_SIZE_STEPS, savedMessageSize);
            this.tpl.querySelector<HTMLElement>(`:scope >.content [name="interface-size"][value="${interfaceStep}"]`)?.click();
            this.tpl.querySelector<HTMLElement>(`:scope >.content [name="message-text-size"][value="${messageStep}"]`)?.click();
            colorScheme.click();

            // Синхронизируем живое превью с сохранёнными значениями
            this._updatePreviews();

            // Если выбрана сторонняя тема
            if (session.settings.user.themes?.current?.style) {

                // invariant: имя темы приходит с сервера строкой
                currentThemeName.textContent = session.settings.user.themes?.current?.name as string;
            } else {
                currentThemeName.textContent = window._lc.forms.user_setting_decoration.not_selected;
            }

            // Если фоны включены
            if (session.settings.user.decorations.chat_background.enabled) {
                isChatBackgrounds.click();
            }

            // Если размытие включено
            if (session.settings.user.decorations.blur) {
                isBlur.click();
            }

            // Отображаем пресеты акцентного цвета
            const brandColorListItem = this.tpl.querySelector(`:scope >.content [data-list-brand-colors]`);
            BRAND_COLORS.forEach(color => brandColorListItem?.append(createBrandColorItem(this, color)));

            // Восстанавливаем сохранённый акцентный цвет
            const savedBrandColor = session.settings.user.decorations.brand_color || "";
            const brandColorRadio = this.tpl.querySelector<HTMLElement>(`:scope >.content [data-brand-color][data-color="${savedBrandColor}"]`);
            brandColorRadio?.click();

            // Кастомный инпут: подставляем текущий цвет, чтобы квадратик не был чёрным
            const customBrandColorInput = this.tpl.querySelector<HTMLInputElement>(`:scope >.content [name="brand-color-custom"]`);
            if (customBrandColorInput) {
                customBrandColorInput.value = savedBrandColor
                    || getComputedStyle(document.documentElement).getPropertyValue("--color-brand").trim()
                    || "#000000";
            }

            // Скругление интерфейса
            const savedUiRadius = session.settings.user.decorations.ui_radius || "default";
            const uiRadiusRadio = this.tpl.querySelector<HTMLElement>(`:scope >.content [name="ui-radius"][value="${savedUiRadius}"]`);
            uiRadiusRadio?.click();

            // Отображаем фоны
            CHAT_BACKGROUNDS.forEach(pattern => {
                this.store.add({ id: pattern });
            });

            // Инициализируем скроллбар
            this.osListScrollInstance = OverlayScrollbars(this.content, {
                scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
            });

            // Активируем переключатели (включая карточки размеров —
            // они рендерятся строкой в шаблоне)
            Toggle.hydrate(this.tpl);

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
    // Обновление живых превью (масштаб интерфейса и размер текста сообщений)
    // Превью отражают реальную типографику: заголовок как text-lg (1.125rem),
    // текст интерфейса как базовый размер (1rem), текст сообщений с учётом
    // текущих значений обоих ползунков.
    // ***************************************************************************
    _updatePreviews(): void {

        // Шаблон создаётся в _open — без него показывать нечего
        if (!this.tpl) return;

        // Целевые масштабы — значения выбранных карточек (готовые множители
        // от 16px: "0.875" = 14px). Фолбэк интерфейса — 0.875 (14px),
        // фолбэк текста сообщений — 1 (базовый масштаб)
        const interfaceScale = Number(this.tpl.querySelector<HTMLInputElement>(`:scope >.content [name="interface-size"]:checked`)?.value) || 0.875;
        const messageScale = Number(this.tpl.querySelector<HTMLInputElement>(`:scope >.content [name="message-text-size"]:checked`)?.value) || 1;

        // Размеры задаём в пикселях, чтобы превью не масштабировалось повторно
        // от корневого шрифта: 1rem базово равен 16px, а интерфейс умножается
        // на interfaceScale. Так превью точно совпадает с реальным UI.

        // ==================================
        // Превью масштаба интерфейса
        // ==================================
        const preview = this.tpl.querySelector(`:scope >.content [data-interface-preview]`);
        if (preview) {

            // Заголовок соответствует text-lg (1.125rem), текст — базовому размеру (1rem)
            const title = preview.querySelector<HTMLElement>("[data-preview-title]");
            const text = preview.querySelector<HTMLElement>("[data-preview-text]");

            if (title) title.style.fontSize = `${1.125 * 16 * interfaceScale}px`;
            if (text) text.style.fontSize = `${16 * interfaceScale}px`;

        }

        // ==================================
        // Превью размера текста сообщений
        // ==================================
        const messagePreview = this.tpl.querySelector(`:scope >.content [data-message-text-preview]`);
        if (messagePreview) {

            // Имя сообщения соответствует text-sm (0.875rem)
            const name = messagePreview.querySelector<HTMLElement>("span:nth-child(1)");
            // Текст сообщения масштабируется от размера текста сообщений
            const text = messagePreview.querySelector<HTMLElement>("span:nth-child(2)");

            if (name) name.style.fontSize = `${0.875 * 16 * interfaceScale}px`;
            if (text) text.style.fontSize = `${16 * messageScale * interfaceScale}px`;

        }

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Удаляем экземпляр формы
        UserSettingDecorations.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`

            <div class="cdm-form user-setting-decorations flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "ArrowLeft" })}
                </div>
                 <div class="content w-full h-full flex ${CDM_FORM_CONTENT_CLASSES()}">

                    <div class="flex flex-col gap-3 p-3 max-w-[var(--form-max-content-width)] m-auto w-full">

                        <!-- Размер интерфейса -->
                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("text-size", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.user_setting_decoration.interface_size}
                            </span>
                            <span class="text-sm text-secondary">${window._lc.forms.user_setting_decoration.interface_size_desc}</span>

                            <!-- Живое превью масштаба интерфейса -->
                            <div class="flex flex-col gap-1 p-3 rounded-lg bg-[var(--form-bg)] border border-[var(--border-color)]" data-interface-preview>
                                <span data-preview-title class="font-semibold text-lg">${window._lc.forms.user_setting_decoration.preview_title}</span>
                                <span data-preview-text class="text-secondary">${window._lc.forms.user_setting_decoration.preview_text}</span>
                            </div>

                            ${Toggle.cardGroup([
        { name: "interface-size", value: "0.75", checked: false, text: window._lc.forms.user_setting_decoration.size_label_very_small },
        { name: "interface-size", value: "0.8125", checked: false, text: window._lc.forms.user_setting_decoration.size_label_small },
        { name: "interface-size", value: "0.875", checked: true, text: window._lc.forms.user_setting_decoration.size_label_normal },
        { name: "interface-size", value: "0.9375", checked: false, text: window._lc.forms.user_setting_decoration.size_label_large },
        { name: "interface-size", value: "1", checked: false, text: window._lc.forms.user_setting_decoration.size_label_very_large }
    ])}
                        </div>

                        <!-- Размер текста сообщений -->
                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("typography", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.user_setting_decoration.message_text_size}
                            </span>
                            <span class="text-sm text-secondary">${window._lc.forms.user_setting_decoration.message_text_size_desc}</span>

                            <!-- Живое превью размера текста сообщений -->
                            <div data-message-text-preview class="flex flex-col gap-0.5 p-3 rounded-lg bg-[var(--form-bg)] border border-[var(--border-color)]">
                                <span class="text-sm text-secondary">${window._lc.forms.user_setting_decoration.message_name}</span>
                                <span>${window._lc.forms.user_setting_decoration.message_text}</span>
                            </div>

                            ${Toggle.cardGroup([
        { name: "message-text-size", value: "0.875", checked: false, text: window._lc.forms.user_setting_decoration.size_label_very_small },
        { name: "message-text-size", value: "0.9375", checked: false, text: window._lc.forms.user_setting_decoration.size_label_small },
        { name: "message-text-size", value: "1", checked: true, text: window._lc.forms.user_setting_decoration.size_label_normal },
        { name: "message-text-size", value: "1.0625", checked: false, text: window._lc.forms.user_setting_decoration.size_label_large },
        { name: "message-text-size", value: "1.125", checked: false, text: window._lc.forms.user_setting_decoration.size_label_very_large }
    ])}
                        </div>

                        <!-- Цветовая схема -->
                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <div class="flex flex-col gap-3">
                                <span class="flex flex-row gap-2 items-center font-semibold">
                                    <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                        ${Icons.icon("contrast", { settings: { size: 20 } })?.outerHTML ?? ""}
                                    </span>
                                    ${window._lc.forms.user_setting_decoration.color_scheme}
                                </span>
                                <span class="text-sm text-secondary">${window._lc.forms.user_setting_decoration.color_scheme_desc}</span>
                            </div>

                            ${Toggle.cardGroup([
        { name: "color-scheme", value: "system", checked: true, text: window._lc.forms.user_setting_decoration.system, description: window._lc.forms.user_setting_decoration.system_desc },
        { name: "color-scheme", value: "light", checked: false, text: window._lc.forms.user_setting_decoration.white, description: window._lc.forms.user_setting_decoration.white_desc },
        { name: "color-scheme", value: "dark", checked: false, text: window._lc.forms.user_setting_decoration.dark, description: window._lc.forms.user_setting_decoration.dark_desc }
    ])}

                        </div>

                        <!-- Акцентный цвет -->
                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <div class="flex flex-col gap-3">
                                <span class="flex flex-row gap-2 items-center font-semibold">
                                    <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                        ${Icons.icon("palette", { settings: { size: 20 } })?.outerHTML ?? ""}
                                    </span>
                                    ${window._lc.forms.user_setting_decoration.brand_color}
                                </span>
                                <span class="text-sm text-secondary">${window._lc.forms.user_setting_decoration.brand_color_desc}</span>
                            </div>
                            <div data-list-brand-colors class="grid grid-cols-[repeat(auto-fill,minmax(36px,1fr))] gap-2 p-0 w-full"></div>
                            <div class="flex flex-row items-center gap-2 p-2 rounded-lg bg-[var(--form-bg)]">
                                <input type="color" name="brand-color-custom" class="w-8 h-8 rounded-lg cursor-pointer" value="">
                                <span class="text-sm text-secondary">${window._lc.forms.user_setting_decoration.custom_color}</span>
                            </div>
                        </div>

                        <!-- Скругление интерфейса -->
                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <div class="flex flex-col gap-0.5">
                                <span class="flex flex-row gap-2 items-center font-semibold">
                                    <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                        ${Icons.icon("border-radius", { settings: { size: 20 } })?.outerHTML ?? ""}
                                    </span>
                                    ${window._lc.forms.user_setting_decoration.ui_radius}
                                </span>
                                <span class="text-sm text-secondary">${window._lc.forms.user_setting_decoration.ui_radius_desc}</span>
                            </div>
                            ${Toggle.cardGroup([
        { name: "ui-radius", value: "compact", checked: false, text: window._lc.forms.user_setting_decoration.ui_radius_compact, description: window._lc.forms.user_setting_decoration.ui_radius_compact_desc },
        { name: "ui-radius", value: "default", checked: true, text: window._lc.forms.user_setting_decoration.ui_radius_default, description: window._lc.forms.user_setting_decoration.ui_radius_default_desc },
        { name: "ui-radius", value: "round", checked: false, text: window._lc.forms.user_setting_decoration.ui_radius_round, description: window._lc.forms.user_setting_decoration.ui_radius_round_desc }
    ])}
                        </div>

                        <!-- Текущая тема -->
                        <div class="flex flex-row gap-3 items-center ${CDM_FORM_SECTION_CLASSES()}">
                            <div class="flex flex-col gap-3 w-full justify-between">
                                <span class="flex flex-row gap-2 items-center font-semibold">
                                    <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                        ${Icons.icon("brush", { settings: { size: 20 } })?.outerHTML ?? ""}
                                    </span>
                                    ${window._lc.forms.user_setting_decoration.current_theme}
                                </span>
                                <span data-current-theme class="text-sm text-[var(--color-brand)] dark:text-[var(--color-brand)]"></span>
                            </div>
                            ${Buttons.transparent({ shape: "circle", attributes: ["action-reset-theme"], icon: "trash" })}
                        </div>

                        <!-- Фоны чата -->
                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("wallpaper", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.user_setting_decoration.chat_backgrounds}
                            </span>
                            ${Toggle.switch({ name: "is-chat-background-enabled", checked: false, classes: ["row-reverse", "justify-between"], toggleText: { on: window._lc.forms.user_setting_decoration.enabled, off: window._lc.forms.user_setting_decoration.disabled } })}
                            <div data-list-chat-backgrounds class="grid grid-cols-3 gap-2 p-0 w-full"></div>
                        </div>

                        <!-- Размытие -->
                        <div class="flex flex-row gap-3 items-center ${CDM_FORM_SECTION_CLASSES()}">
                            <div class="flex flex-col gap-3 w-full justify-between">
                                <span class="flex flex-row gap-2 items-center font-semibold">
                                    <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                        ${Icons.icon("blur", { settings: { size: 20 } })?.outerHTML ?? ""}
                                    </span>
                                    ${window._lc.forms.user_setting_decoration.blur_elements}
                                </span>
                                <span class="text-sm text-secondary">${window._lc.forms.user_setting_decoration.blur_elements_desc}</span>
                                ${Toggle.switch({
            name: "is-blur-enabled",
            checked: false,
            toggleText: {
                on: window._lc.forms.user_setting_decoration.enabled,
                off: window._lc.forms.user_setting_decoration.disabled
            }
        })}
                            </div>
                        </div>

                    </div>

                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

    }

}
