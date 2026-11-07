// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES, CDM_FORM_SECTION_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Icons } from "../../utils/icons.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { Toggle } from "../../components/toggle.js";

// Импортируем handlers
import { saveHandler } from "./handlers/save.js";

// Импортируем forms
import { UserProfile } from "../user-profile/index.js";

// Импортируем requests
import { getPrivacySettingsRequest } from "./requests/get_privacy_settings.js";
import { t } from "../../utils/i18n/index.js";

/**
 * Настройки формы конфиденциальности.
 */
export interface UserSettingPrivacyOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные конструктора формы.
 */
export interface UserSettingPrivacyData {

    /** Id пользователя. */
    userId: string;

    /** Настройки формы. */
    options?: UserSettingPrivacyOptions;

}

// Form
export class UserSettingPrivacy {

    // Переменная для хранения единственного экземпляра формы
    static instance: UserSettingPrivacy | null = null;

    /** Настройки формы. */
    options: UserSettingPrivacyOptions;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Контент формы (скролл-контейнер OverlayScrollbars). */
    content: HTMLElement | null = null;

    /** Инстанс OverlayScrollbars списка. */
    osListScrollInstance: OverlayScrollbars | null = null;

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
    constructor(data: UserSettingPrivacyData) {

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
        if (UserSettingPrivacy.instance) {
            return UserSettingPrivacy.instance;
        }

        // Инициализация
        this._init();

    }

    // ***************************************************************************
    // Инициализация
    // ***************************************************************************
    async _init(): Promise<void> {

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
                url: `?user-setting-privacy=${this.userId}`,
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
    // Форма открылась
    // ***************************************************************************
    _onOpen(): void {

        this._handlers();

    }

    // ***************************************************************************
    // Обработчики
    // ***************************************************************************
    _handlers(): void {

        try {

            // Обработчики вешаются на узлы шаблона — без него нечего слушать
            if (!this.tpl) return;

            // Закрыть
            const close = this.tpl.querySelector(`:scope >.header [action-close]`);
            close?.addEventListener("click", () => this.modal?.close());

            // Сохранить
            const save = this.tpl.querySelectorAll(`:scope >.header [action-save]`);
            save.forEach(schema => schema?.addEventListener("click", () => saveHandler(this)));

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Настройка формы
    // ***************************************************************************
    async _onBeforeOpen(): Promise<void> {

        try {

            // Запрос
            const privacy = await getPrivacySettingsRequest();

            // Без данных сервера настройки не заполнить
            if (!privacy.data) return;

            // Элементы заполняются из шаблона — без него нечего настраивать
            if (!this.tpl) return;

            // Устанавливаем элементы
            this.content = this.tpl.querySelector(":scope >.content");
            const calls = this.tpl.querySelector<HTMLElement>(`:scope >.content [name="calls"][value="${privacy.data.privacy_calls}"]`);
            const messages = this.tpl.querySelector<HTMLElement>(`:scope >.content [name="messages"][value="${privacy.data.privacy_messages}"]`);
            const messageVoice = this.tpl.querySelector<HTMLElement>(`:scope >.content [name="messages-voice"][value="${privacy.data.privacy_messages_voice}"]`);
            const searchUsers = this.tpl.querySelector<HTMLElement>(`:scope >.content [name="search-users"][value="${privacy.data.privacy_search_users}"]`);
            const sharingFiles = this.tpl.querySelector<HTMLElement>(`:scope >.content [name="sharing-files"][value="${privacy.data.privacy_sharing_files}"]`);

            // Выбираем параметры
            // NOTE(MIGRATION): некоторые поля может не быть в ответе сервера
            // (например, privacy_sharing_files сервер пока не возвращает) —
            // защищаемся от null, чтобы не оборвать настройку формы
            calls?.click();
            messages?.click();
            messageVoice?.click();
            searchUsers?.click();
            sharingFiles?.click();

            // Инициализируем скроллбар
            const content = this.content;
            if (content) {
                this.osListScrollInstance = OverlayScrollbars(content, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
            }

            // Активируем переключатели
            Toggle.hydrate(this.tpl);

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Удаляем экземпляр формы
        UserSettingPrivacy.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement {

        // invariant: корневой .cdm-form входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`

            <div class="cdm-form user-setting-privacy flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.create({
                        intent: "transparent",
                        shape: "circle",
                        attributes: ["action-close"],
                        icon: "ArrowLeft"
                    })}
                    ${Buttons.create({
                        intent: "transparent",
                        shape: "circle",
                        attributes: ["action-save"],
                        icon: "device-floppy"
                    })}
                </div>
                 <div class="content w-full h-full flex ${CDM_FORM_CONTENT_CLASSES()}">

                    <div class="flex flex-col gap-3 p-3 max-w-[var(--form-max-content-width)] m-auto w-full">

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("phone", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.user_setting_privacy.calls")}
                            </span>

                            ${Toggle.cardGroup([
        { name: "calls", value: "all", checked: true, text: t("forms.user_setting_privacy.all") },
        { name: "calls", value: "contacts", checked: false, text: t("forms.user_setting_privacy.contacts") },
        { name: "calls", value: "none", checked: false, text: t("forms.user_setting_privacy.none") }
    ])}

                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("message", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.user_setting_privacy.messages")}
                            </span>

                            ${Toggle.cardGroup([
        { name: "messages", value: "all", checked: true, text: t("forms.user_setting_privacy.all") },
        { name: "messages", value: "contacts", checked: false, text: t("forms.user_setting_privacy.contacts") },
        { name: "messages", value: "none", checked: false, text: t("forms.user_setting_privacy.none") }
    ])}

                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("microphone", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.user_setting_privacy.messages_voice")}
                            </span>

                            ${Toggle.cardGroup([
        { name: "messages-voice", value: "all", checked: true, text: t("forms.user_setting_privacy.all") },
        { name: "messages-voice", value: "contacts", checked: false, text: t("forms.user_setting_privacy.contacts") },
        { name: "messages-voice", value: "none", checked: false, text: t("forms.user_setting_privacy.none") }
    ])}

                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("search", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.user_setting_privacy.search_users")}
                            </span>

                            ${Toggle.cardGroup([
        { name: "search-users", value: "all", checked: true, text: t("forms.user_setting_privacy.all") },
        { name: "search-users", value: "contacts", checked: false, text: t("forms.user_setting_privacy.contacts") },
        { name: "search-users", value: "none", checked: false, text: t("forms.user_setting_privacy.none") }
    ])}

                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}" disabled>
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("files", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.user_setting_privacy.sharing_files")}
                            </span>

                            ${Toggle.cardGroup([
        { name: "sharing-files", value: "all", checked: true, text: t("forms.user_setting_privacy.all") },
        { name: "sharing-files", value: "contacts", checked: false, text: t("forms.user_setting_privacy.contacts") },
        { name: "sharing-files", value: "none", checked: false, text: t("forms.user_setting_privacy.none") }
    ])}

                        </div>

                    </div>

                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form")!;

    }

}
