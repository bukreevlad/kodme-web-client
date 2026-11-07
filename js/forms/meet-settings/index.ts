// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES, CDM_FORM_SECTION_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Icons } from "../../utils/icons.js";
import { CacheManager } from "../../utils/cache_manager.js";
import { getThumbnailSizeQuery } from "../../utils/helpers/get_thumbnail_size_query.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { Inputs } from "../../components/inputs.js";
import { Toggle } from "../../components/toggle.js";

// Импортируем handlers
import { saveHandler } from "./handlers/save.js";
import { switchIsPublicHandler } from "./handlers/switch-is-public.js";
import { thumbnailContextMenuHandler } from "./handlers/thumb_menu.js";
import { removeHandler } from "./handlers/remove.js";

// Импортируем requests
import { getMeetSettingsRequest } from "./requests/get_meet_settings.js";

// Импортируем forms
import { MeetManageInvites } from "../meet-manage-invites/index.js";
import { MeetPlay } from "../meet-play/index.js";
import { t } from "../../utils/i18n/index.js";

/**
 * Настройки формы настроек конференции.
 */
export interface MeetSettingsOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные конструктора формы.
 */
export interface MeetSettingsData {

    /** Id конференции. */
    meetId: string;

    /** Настройки формы. */
    options?: MeetSettingsOptions;

}

// Form
export class MeetSettings {

    // Реестр всех открытых форм MeetSettings: { meetId: instance }
    static instances = new Map<string, MeetSettings>();

    // Переменные формы
    meetId: string;

    // Каркас: шаблон, модалка, контент и instance скролла
    options: MeetSettingsOptions;
    tpl: HTMLElement | null;
    modal: Overlay | null;
    content: HTMLElement | null;
    osListScrollInstance: OverlayScrollbars | null;

    // Элементы обложки
    thumb: HTMLElement | null;
    thumbImage: HTMLImageElement | null;

    /**
     * ***************************************************************************
     * Форма настроек конференции.
     * @param data - Данные.
     * @param data.meetId - Id конференции.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: MeetSettingsData) {

        // Если не передан meetId
        if (!data?.meetId) throw new Error("Не передан: meetId");

        // Поиск открытого окна конференции
        let meetPlayForm = MeetPlay.instances.get(data.meetId);
        let insertInto = meetPlayForm?.modal?.content || null;

        // Устанавливаем настройки
        this.options = {
            insertInto,
            ...data?.options
        };

        // Переменные формы
        this.tpl = null;
        this.modal = null;
        this.content = null;
        this.osListScrollInstance = null; // overlayScroll instance
        this.thumb = null;
        this.thumbImage = null;

        // Переменные формы
        this.meetId = data.meetId;

        // Регистрируем этот экземпляр формы
        // Проверяем, существует ли уже экземпляр
        let instance = MeetSettings.instances.get(data.meetId);
        if (instance) return instance;

        MeetSettings.instances.set(this.meetId, this);

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
                url: `?meet-settings=${this.meetId}`,
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

            // Контекстное меню обложки
            let thumbnailContextMenu = this.tpl.querySelector(":scope >.content [action-choose-thumb]");
            thumbnailContextMenu?.addEventListener("click", (event) => thumbnailContextMenuHandler(event, this));

            // Переключение публичности
            let isPublic = this.tpl.querySelector(`:scope >.content [name="is-public"]`);
            isPublic?.addEventListener("change", () => switchIsPublicHandler(this));

            // Управление приглашениями
            let manageInvites = this.tpl.querySelector(":scope >.content [action-manage-invites]");
            manageInvites?.addEventListener("click", () => new MeetManageInvites({ meetId: this.meetId }));

            // Полное удаление
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

            // Запрос
            let response = await getMeetSettingsRequest({ meet_id: this.meetId });

            // Данные
            let data = response.data;

            // Элементы заполняются из шаблона — без него открываться нечему
            if (!this.tpl) {
                this.modal?.close();
                return;
            }

            // Устанавливаем элементы
            this.content = this.tpl.querySelector(":scope >.content");
            this.thumb = this.tpl.querySelector(`:scope >.content [data-thumb-wrap]`);
            this.thumbImage = this.tpl.querySelector(`:scope >.content [data-thumb-wrap] [data-thumbnail]`);
            let name = this.tpl.querySelector<HTMLInputElement>(`:scope >.content [name="name"]`);
            let about = this.tpl.querySelector<HTMLInputElement>(`:scope >.content [name="about"]`);
            let isPublic = this.tpl.querySelector<HTMLInputElement>(`:scope >.content [name="is-public"]`);
            let isChat = this.tpl.querySelector<HTMLInputElement>(`:scope >.content [name="is-chat"]`);

            // Обязательные элементы шаблона: без них гидратация не работает,
            // ошибка уйдёт в catch ниже (лог плюс закрытие формы)
            if (!name || !about || !isPublic || !isChat) {
                throw new Error("[meet-settings]: не найдены обязательные элементы шаблона");
            }

            // Если есть обложка
            if (data.thumbnail) {

                // Получения размера миниатюры
                const thumbnails = data.thumbnail?.metadata?.thumbnails;
                const thumbSize = getThumbnailSizeQuery(thumbnails, 800);

                // Формируем ссылку через CacheManager
                const mediaUrl = CacheManager.getMediaSrc({
                    url: `${window.location.protocol}//${window.location.hostname}/api/v1/storage/${data.thumbnail.id}${thumbSize.string}`,
                    file_token: data.thumbnail.token,
                    type: "image"
                });

                // Устанавливаем ссылку
                if (this.thumbImage) this.thumbImage.src = mediaUrl;

            }

            // Записываем данные (описание у конференции может быть null —
            // в value оно попало бы строкой "null")
            name.value = data.name;
            about.value = data.about ?? "";

            // Приватность
            if (data.is_public) {
                isPublic.click();
                switchIsPublicHandler(this);
            }

            // Чат конференции
            data.is_chat && isChat.click();

            // Инициализируем скролл
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
            this.modal?.close();
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

        // Удаляем экземпляр формы из реестра
        MeetSettings.instances.delete(this.meetId);

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`

            <div class="cdm-form meet-settings flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "ArrowLeft" })}
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-save"], icon: "device-floppy" })}
                </div>
                 <div class="content w-full h-full flex ${CDM_FORM_CONTENT_CLASSES()}">

                    <div class="flex flex-col gap-3 p-3 max-w-[var(--form-max-content-width)] m-auto w-full">

                        <div class="flex flex-col gap-3 pb-0 items-center">
                            <div data-thumb-wrap class="relative flex flex-col items-center w-full h-full aspect-16/9 overflow-hidden rounded-md">
                                <img data-thumbnail class="w-full h-full aspect-16/9 absolute bg-[var(--second-bg)] object-cover" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" />
                            </div>
                            ${Buttons.primary({ attributes: ["action-choose-thumb"], text: t("forms.meet_settings.choose_thumb") })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("label", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.meet_settings.name")}
                            </span>
                            ${Inputs.create({ placeholder: t("forms.meet_settings.name"), name: "name", attributes: ["required"] })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("message-circle", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.meet_settings.about")}
                            </span>
                            ${Inputs.textarea({ placeholder: t("forms.meet_settings.about"), name: "about", rows: 4 })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("world", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.meet_settings.is_public_cast")}
                            </span>
                            <span class="text-sm text-secondary">${t("forms.meet_settings.is_public_cast_desc")}</span>
                            ${Toggle.switch({
            name: "is-public",
            checked: false,
            toggleText: {
                on: t("forms.meet_settings.opened"),
                off: t("forms.meet_settings.closed")
            }
        })}
                        </div>

                        <div data-invites class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("user-plus", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.meet_settings.invites")}
                            </span>
                            <span class="text-sm text-secondary">${t("forms.meet_settings.invites_desc")}</span>
                            ${Buttons.create({ attributes: ["action-manage-invites"], text: t("forms.meet_settings.invites") })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("messages", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.meet_settings.is_chat_cast")}
                            </span>
                            <span class="text-sm text-secondary">${t("forms.meet_settings.is_chat_cast_desc")}</span>
                            ${Toggle.switch({
            name: "is-chat",
            checked: false,
            toggleText: {
                on: t("forms.meet_settings.enabled"),
                off: t("forms.meet_settings.disabled")
            }
        })}
                        </div>

                        <div data-invites class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("trash", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.meet_settings.remove")}
                            </span>
                            <span class="text-sm text-secondary">${t("forms.meet_settings.remove_desc")}</span>
                            ${Buttons.danger({ attributes: ["action-remove"], text: t("forms.meet_settings.remove") })}
                        </div>

                    </div>

                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

    }

}
