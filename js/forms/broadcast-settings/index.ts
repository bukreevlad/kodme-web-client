// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES, CDM_FORM_SECTION_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Icons } from "../../utils/icons.js";
import { LocalStorage } from "../../utils/local_storage.js";
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
import { getCastSettingsRequest } from "./requests/get_cast_settings.js";

// Импортируем forms
import { BroadcastManageInvites } from "../broadcast-manage-invites/index.js";
import { BroadcastPlay } from "../broadcast-play/index.js";

// Импортируем типы
import type { SessionProfile } from "../menu/types.js";
import type { BroadcastSettingsRecord } from "./types.js";
import { t } from "../../utils/i18n/index.js";

/**
 * Данные формы настроек трансляции.
 */
export interface BroadcastSettingsData {

    /** Id трансляции. */
    castId: string;

    /** Настройки формы. */
    options?: BroadcastSettingsOptions;

}

/**
 * Настройки формы настроек трансляции.
 */
export interface BroadcastSettingsOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

// Form
export class BroadcastSettings {

    // Реестр всех открытых форм BroadcastSettings: { castId: instance }
    static instances = new Map<string, BroadcastSettings>();

    // Переменные формы
    castId: string;

    // Каркас: шаблон, модалка, контент и instance скролла
    options: BroadcastSettingsOptions;
    tpl: HTMLElement | null;
    modal: Overlay | null;
    content: HTMLElement | null;
    thumb: HTMLElement | null;
    thumbImage: HTMLImageElement | null;
    osListScrollInstance: OverlayScrollbars | null;

    /**
     * ***************************************************************************
     * Форма настроек трансляции.
     * @param data - Данные.
     * @param data.castId - Id трансляции.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: BroadcastSettingsData) {

        // Если не передан castId
        if (!data?.castId) throw new Error("Не передан: castId");

        // Поиск открытого окна трансляции
        let broadcastPlayForm = BroadcastPlay.instances.get(data.castId);
        let insertInto = broadcastPlayForm?.modal?.content || null;

        // Устанавливаем настройки
        this.options = {
            insertInto,
            ...data?.options
        };

        // Переменные формы
        this.tpl = null;
        this.modal = null;
        this.content = null;
        this.thumb = null;
        this.thumbImage = null;
        this.osListScrollInstance = null; // overlayScroll instance

        // Переменные формы
        this.castId = data.castId;

        // Получаем instance
        let instance = BroadcastSettings.instances.get(data.castId);
        if (instance) return instance;

        // Регистрируем этот экземпляр формы
        BroadcastSettings.instances.set(this.castId, this);

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
                url: `?broadcast-settings=${this.castId}`,
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
            let switchIsPublic = this.tpl.querySelector(`:scope >.content [name="is-public"]`);
            switchIsPublic?.addEventListener("change", () => switchIsPublicHandler(this));

            // Управление приглашениями
            let manageInvites = this.tpl.querySelector(":scope >.content [action-manage-invites]");
            manageInvites?.addEventListener("click", () => new BroadcastManageInvites({ castId: this.castId }));

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

            // Элементы заполняются из шаблона — без него нечего настраивать
            if (!this.tpl) return;

            // Сессия пользователя
            let session = LocalStorage.session;

            // Запрос
            let response = await getCastSettingsRequest({ cast_id: this.castId });

            // Данные
            let data = response.data;

            // Устанавливаем элементы
            this.content = this.tpl.querySelector(":scope >.content");
            this.thumb = this.tpl.querySelector(`:scope >.content [data-thumb-wrap]`);
            this.thumbImage = this.tpl.querySelector(`:scope >.content [data-thumb-wrap] [data-thumbnail]`);
            let name = this.tpl.querySelector<HTMLInputElement>(`:scope >.content [name="name"]`);
            let about = this.tpl.querySelector<HTMLInputElement>(`:scope >.content [name="about"]`);
            let rtmpUrl = this.tpl.querySelector<HTMLInputElement>(`:scope >.content [name="rtmp-url"]`);
            let rtmpKey = this.tpl.querySelector<HTMLInputElement>(`:scope >.content [name="rtmp-key"]`);
            let whipUrl = this.tpl.querySelector<HTMLInputElement>(`:scope >.content [name="whip-url"]`);
            let chatUrl = this.tpl.querySelector<HTMLInputElement>(`:scope >.content [name="chat-url"]`);
            let isPublic = this.tpl.querySelector<HTMLInputElement>(`:scope >.content [name="is-public"]`);
            let isChat = this.tpl.querySelector<HTMLInputElement>(`:scope >.content [name="is-chat"]`);

            // invariant: все input входят в шаблон _template() — при отсутствии
            // одного из них заполнять форму не из чего (легаси падал в catch)
            if (!name || !about || !rtmpUrl || !rtmpKey || !whipUrl || !chatUrl || !isPublic || !isChat) return;

            // Если есть обложка
            if (data.thumbnail) {

                // Получения размера миниатюры
                const thumbnails = data.thumbnail?.metadata?.thumbnails;
                const thumbSize = getThumbnailSizeQuery(thumbnails, 800);

                // Формируем ссылку через CacheManager
                const mediaUrl = CacheManager.getMediaSrc({
                    url: `${window.location.protocol}//${window.location.hostname}/api/v1/storage/${data.thumbnail.id}${thumbSize?.string}`,
                    file_token: data.thumbnail.token,
                    type: "image"
                });

                // Устанавливаем ссылку
                if (this.thumbImage) this.thumbImage.src = mediaUrl;

            }

            // Записываем данные (about опционален — нормализуем, чтобы в поле
            // не «утекало» undefined/null)
            name.value = data.name;
            about.value = data.about ?? "";
            rtmpUrl.value = `rtmp://${window.location.hostname}/live`;
            rtmpKey.value = `${this.castId}?token=${data.token}`;
            whipUrl.value = `${window.location.protocol}//${window.location.hostname}/api/v1/cast/whip/?app=live&type=push&stream=${this.castId}&token=${data.token}`;

            // Приватность
            if (data.is_public) {
                isPublic.click();
                switchIsPublicHandler(this);
            }

            data.is_chat && isChat.click();

            // invariant: session — текущая сессия пользователя в localStorage,
            // пользователь уже аутентифицирован, когда форма настроек открыта
            const user = session?.user as SessionProfile;

            // Url для онлайн чата трансляции
            let base64Url = JSON.stringify({ userId: user?.id, castId: this.castId, token: data.token });
            chatUrl.value = `${window.location.protocol}//${window.location.hostname}/?broadcastOnlineChat=${btoa(base64Url)}`;

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
        BroadcastSettings.instances.delete(this.castId);

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`
        
            <div class="cdm-form broadcast-settings flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.circle({ intent: "transparent", attributes: ["action-close"], icon: "ArrowLeft" })}
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-save"], icon: "device-floppy" })}
                </div>
                 <div class="content w-full h-full flex ${CDM_FORM_CONTENT_CLASSES()}">

                    <div class="flex flex-col gap-3 p-3 max-w-[var(--form-max-content-width)] m-auto w-full">

                        <div class="flex flex-col gap-3 pb-0 items-center">
                            <div data-thumb-wrap class="relative flex flex-col items-center w-full h-full aspect-16/9 overflow-hidden rounded-md">
                                <img data-thumbnail class="w-full h-full aspect-16/9 absolute bg-[var(--second-bg)] object-cover" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" />
                            </div>
                            ${Buttons.primary({ attributes: ["action-choose-thumb"], classes: ["w-full"], text: t("forms.broadcast_settings.choose_thumb") })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("label", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.broadcast_settings.name")}
                            </span>
                            ${Inputs.create({ placeholder: t("forms.broadcast_settings.name"), name: "name", attributes: ["required"] })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("message-circle", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.broadcast_settings.about")}
                            </span>
                            ${Inputs.textarea({ placeholder: t("forms.broadcast_settings.about"), name: "about", rows: 4 })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("broadcast", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.broadcast_settings.rtmp_url")}
                            </span>
                            ${Inputs.create({ placeholder: t("forms.broadcast_settings.rtmp_url"), name: "rtmp-url", })}
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("key", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.broadcast_settings.rtmp_key")}
                            </span>
                            ${Inputs.create({ placeholder: t("forms.broadcast_settings.rtmp_key"), name: "rtmp-key", })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("cast", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.broadcast_settings.whip_url")}
                            </span>
                            ${Inputs.create({ placeholder: t("forms.broadcast_settings.whip_url"), name: "whip-url", })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("message", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.broadcast_settings.chat_url")}
                            </span>
                            ${Inputs.create({ placeholder: t("forms.broadcast_settings.chat_url"), name: "chat-url", })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("world", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.broadcast_settings.is_public_cast")}
                            </span>
                            <span class="text-sm text-secondary">${t("forms.broadcast_settings.is_public_cast_desc")}</span>
                            ${Toggle.switch({
            name: "is-public", checked: false,
            toggleText: {
                on: t("forms.broadcast_settings.opened"),
                off: t("forms.broadcast_settings.closed")
            }
        })}
                        </div>

                        <div data-invites class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("user-plus", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.broadcast_settings.invites")}
                            </span>
                            <span class="text-sm text-secondary">${t("forms.broadcast_settings.invites_desc")}</span>
                            ${Buttons.create({ attributes: ["action-manage-invites"], classes: ["w-full"], text: t("forms.broadcast_settings.invites") })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("messages", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.broadcast_settings.is_chat_cast")}
                            </span>
                            <span class="text-sm text-secondary">${t("forms.broadcast_settings.is_chat_cast_desc")}</span>
                            ${Toggle.switch({
            name: "is-chat",
            checked: false,
            toggleText: {
                on: t("forms.broadcast_settings.enabled"),
                off: t("forms.broadcast_settings.disabled")
            }
        })}
                        </div>

                        <div data-invites class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("trash", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.broadcast_settings.remove")}
                            </span>
                            <span class="text-sm text-secondary">${t("forms.broadcast_settings.remove_desc")}</span>
                            ${Buttons.danger({ attributes: ["action-remove"], text: t("forms.broadcast_settings.remove") })}
                        </div>

                    </div>
                    
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

    }

}
