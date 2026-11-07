// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES, CDM_FORM_SECTION_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Icons } from "../../utils/icons.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Avatars } from "../../components/avatars.js";
import { Buttons } from "../../components/buttons.js";
import { Inputs } from "../../components/inputs.js";
import { Toggle } from "../../components/toggle.js";

// Импортируем handlers
import { saveHandler } from "./handlers/save.js";
import { avatarContextMenuHandler } from "./handlers/avatar_menu.js";
import { switchIsPublicHandler } from "./handlers/switch-is-public.js";
import { removeHandler } from "./handlers/remove.js";

// Импортируем requests
import { getSettingsRequest } from "./requests/get_settings.js";

// Импортируем forms
import { ChannelManageInvites } from "../channel-manage-invites/index.js";
import { ChannelProfile } from "../channel-profile/index.js";

// Импортируем типы
import type { GroupTopicSettingsRecord } from "./types.js";

/**
 * Данные формы настроек темы группы.
 */
export interface GroupTopicSettingsData {

    /** Id канала. */
    channelId: string;

    /** Настройки формы. */
    options?: GroupTopicSettingsOptions;

}

/**
 * Настройки формы настроек темы группы.
 */
export interface GroupTopicSettingsOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

// Form
export class GroupTopicSettings {

    // Реестр всех открытых форм GroupTopicSettings: { channelId: instance }
    static instances = new Map<string, GroupTopicSettings>();

    // Переменные формы
    channelId: string;
    settings: GroupTopicSettingsRecord | null;
    avatar: Avatars | null;

    // Каркас: шаблон, модалка, контент и instance скролла
    options: GroupTopicSettingsOptions;
    tpl: HTMLElement | null;
    modal: Overlay | null;
    content: HTMLElement | null;
    osListScrollInstance: OverlayScrollbars | null;

    /**
     * ***************************************************************************
     * Форма настроек темы группы.
     * @param data - Данные.
     * @param data.channelId - Id канала.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: GroupTopicSettingsData) {

        // Если не передан channelId
        if (!data?.channelId) throw new Error("Не передан: channelId");

        // Поиск открытого профиля канала
        let channelProfileForm = ChannelProfile.instances.get(data.channelId);
        let insertInto = channelProfileForm?.modal?.content || null;

        // Устанавливаем настройки
        this.options = {
            insertInto,
            ...data?.options
        }

        // Переменные формы
        this.tpl = null;
        this.modal = null;
        this.content = null;
        this.osListScrollInstance = null; // overlayScroll instance

        // Переменные формы
        this.channelId = data.channelId;
        this.settings = null;
        this.avatar = null;

        // Получаем instance
        let instance = GroupTopicSettings.instances.get(data.channelId);
        if (instance) return instance;

        // Регистрируем этот экземпляр формы
        GroupTopicSettings.instances.set(this.channelId, this);

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

            // Без шаблона открывать форму не из чего
            if (!this.tpl) return;

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "form",
                url: `?group-topic-settings=${this.channelId}`,
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
            let close = this.tpl.querySelector(":scope >.header [action-close]");
            close?.addEventListener("click", () => this.modal?.close());

            // Сохранить
            let save = this.tpl.querySelector(":scope >.header [action-save]");
            save?.addEventListener("click", () => saveHandler(this));

            // Контекстное меню аватара
            let avatarContextMenu = this.tpl.querySelector(":scope >.content [action-choose-photo]");
            avatarContextMenu?.addEventListener("click", (event) => avatarContextMenuHandler(event, this));

            // Переключение публичности
            let switchIsPublic = this.tpl.querySelector(`:scope >.content [name="is-public"]`);
            switchIsPublic?.addEventListener("change", () => switchIsPublicHandler(this));

            // Управление приглашениями
            let manageInvites = this.tpl.querySelector(":scope >.content [action-manage-invites]");
            manageInvites?.addEventListener("click", () => new ChannelManageInvites({ channelId: this.channelId }));

            // Полное удаление темы
            let remove = this.tpl.querySelector(":scope >.content [action-remove]");
            remove?.addEventListener("click", () => removeHandler(this));

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
            this.content = this.tpl.querySelector(":scope >.content");

            // Инициализируем скролл
            const content = this.content;
            if (content) {
                this.osListScrollInstance = OverlayScrollbars(content, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
            }

            // Запрос
            let response = await getSettingsRequest({ channel_id: this.channelId });
            if (!response.data) throw new Error("Не смогли загрузить настройки канала");

            // Активируем переключатели
            Toggle.hydrate(this.tpl);

            // Обновляем форму
            this.update(response.data);

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
    // Обновляем данные формы
    // @param data - Настройки темы.
    // ***************************************************************************
    update(data: GroupTopicSettingsRecord): void {

        // Записываем данные
        this.settings = data;

        // Без шаблона заполнять нечего
        if (!this.tpl) return;

        // Устанавливаем элементы
        let avatar = this.tpl.querySelector<HTMLElement>(":scope >.content .cdm-avatar");
        let name = this.tpl.querySelector<HTMLInputElement>(`:scope >.content [name="name"]`);
        let about = this.tpl.querySelector<HTMLInputElement>(`:scope >.content [name="about"]`);
        let isPublic = this.tpl.querySelector<HTMLInputElement>(`:scope >.content [name="is-public"]`);
        let isPosting = this.tpl.querySelector<HTMLInputElement>(`:scope >.content [name="is-posting"]`);

        // Поля обязаны входить в шаблон — иначе заполнять нечего
        if (!name || !about || !isPublic || !isPosting) return;

        // Аватар
        this.avatar = Avatars.create({
            element: avatar,
            id: data.id,
            name: data.name,
            image: data.avatar,
            size: "3xl"
        });

        // Записываем данные (about опционален — нормализуем, чтобы в поле
        // не «утекало» undefined/null)
        name.value = data.name;
        about.value = data.about ?? "";

        // Приватность
        if (data.is_public) {
            isPublic.click();
            switchIsPublicHandler(this);
        }

        // Кто может написать
        if (data.is_posting) {
            isPosting.click();
        }

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Удаляем экземпляр формы из реестра
        GroupTopicSettings.instances.delete(this.channelId);

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`

            <div class="cdm-form group-topic-settings flex flex-col gap-0 w-full ${CDM_FORM_CLASSES()}">
                <div class="header flex flex-row gap-2 p-2 justify-between ${CDM_FORM_HEADER_CLASSES()}">
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

                        <div class="flex flex-col gap-2xl p-3 py-4 items-center self-center relative">
                            <div class="cdm-avatar relative"></div>
                            ${Buttons.primary({
            shape: "circle",
            attributes: ["action-choose-photo"],
            classes: ["absolute", "z-1", "bottom-[0.5rem]", "right-[0.5rem]"],
            icon: "Camera"
        })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("label", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.group_topic_settings.name}
                            </span>
                            ${Inputs.create({
            placeholder: window._lc.forms.group_topic_settings.name,
            name: "name",
            attributes: ["required"]
        })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("message-circle", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.group_topic_settings.about}
                            </span>
                            ${Inputs.textarea({
            placeholder: window._lc.forms.group_topic_settings.about,
            name: "about",
            rows: 4
        })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("world", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.group_topic_settings.type}
                            </span>
                            <span class="text-sm text-secondary">${window._lc.forms.group_topic_settings.type_desc}</span>
                            ${Toggle.switch({
            name: "is-public",
            checked: false,
            toggleText: {
                on: window._lc.forms.group_topic_settings.opened,
                off: window._lc.forms.group_topic_settings.closed
            }
        })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("pencil", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.group_topic_settings.can_posting}
                            </span>
                            <span class="text-sm text-secondary">${window._lc.forms.group_topic_settings.can_posting_desc}</span>
                            ${Toggle.switch({
            name: "is-posting",
            checked: false,
            toggleText: {
                on: window._lc.forms.group_topic_settings.all_posting,
                off: window._lc.forms.group_topic_settings.admin_posting
            }
        })}
                        </div>

                        <div data-invites class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("user-plus", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.group_topic_settings.invites}
                            </span>
                            <span class="text-sm text-secondary">${window._lc.forms.group_topic_settings.invites_desc}</span>
                            ${Buttons.create({
            shape: "square",
            attributes: ["action-manage-invites"],
            text: window._lc.forms.group_topic_settings.invites
        })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("trash", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.group_topic_settings.remove}
                            </span>
                            <span class="text-sm text-secondary">${window._lc.forms.group_topic_settings.remove_desc}</span>
                            ${Buttons.danger({ attributes: ["action-remove"], text: window._lc.forms.group_topic_settings.remove })}
                        </div>

                    </div>

                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

    }

}
