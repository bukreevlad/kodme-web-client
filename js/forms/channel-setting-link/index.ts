// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES, CDM_FORM_SECTION_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { Inputs } from "../../components/inputs.js";

// Импортируем forms
import { ChannelSettings } from "../channel-settings/index.js";

// Импортируем handlers
import { saveHandler } from "./handlers/save.js";
import { t } from "../../utils/i18n/index.js";

/**
 * Данные формы установки ссылки канала.
 */
export interface ChannelSettingLinkData {

    /** Id канала. */
    channelId: string;

    /** Ссылка канала. */
    link: string;

    /** Настройки формы. */
    options?: ChannelSettingLinkOptions;

}

/**
 * Настройки формы установки ссылки канала.
 */
export interface ChannelSettingLinkOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

// Form
export class ChannelSettingLink {

    // Переменная для хранения единственного экземпляра формы
    static instance: ChannelSettingLink | null = null;

    // Настройки формы
    options: ChannelSettingLinkOptions;

    // Переменные формы
    channelId: string;
    link: string;

    // Каркас: шаблон и модалка
    tpl: HTMLElement | null;
    modal: Overlay | null;

    /**
     * ***************************************************************************
     * Форма установки ссылки канала.
     * @param data - Данные.
     * @param data.channelId - Id канала.
     * @param data.link - Ссылка канала.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: ChannelSettingLinkData) {

        // Если не передан channelId
        if (!data?.channelId) throw new Error("Не передан: channelId");

        // Поиск открытой формы настроек канала: ссылка устанавливается
        // внутри неё. Если настройки закрыты — левая колонка home
        const insertInto: HTMLElement | null = ChannelSettings.instances.get(data.channelId)?.modal?.content
            || document.querySelector(".cdm-form.home .left");

        // Устанавливаем настройки
        this.options = {
            insertInto,
            ...data?.options
        };

        // Переменные формы
        this.tpl = null;
        this.modal = null;

        // Переменные формы
        this.channelId = data.channelId;
        this.link = data.link;

        // Проверяем, существует ли уже экземпляр
        if (ChannelSettingLink.instance) {
            return ChannelSettingLink.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        ChannelSettingLink.instance = this;

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

            if (!this.tpl) return;

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "form",
                url: `?channel-setting-link=${this.channelId}`,
                insertInto: this.options.insertInto,
                closeOnEsc: false,
                closeOnOverlay: false,
                onBeforeOpen: () => this._setup(),
                onOpen: () => this._handlers(),
                onBeforeClose: () => this._onClose()
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

            // Закрыть
            let close = this.tpl?.querySelector(":scope >.header [action-close]");
            close?.addEventListener("click", () => this.modal?.close());

            // Сохранить
            let save = this.tpl?.querySelector(":scope >.header [action-save]");
            save?.addEventListener("click", () => saveHandler(this));

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Настройка формы
    // ***************************************************************************
    async _setup(): Promise<void> {

        try {

            // Устанавливаем элементы
            let link = this.tpl?.querySelector<HTMLInputElement>(`:scope >.content [name="link"]`);

            // Записываем данные
            if (link) link.value = this.link;

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onClose(): void {

        // Удаляем экземпляр формы
        ChannelSettingLink.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`

            <div class="cdm-form channel-setting-link flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full">
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

                    <div class="flex flex-col gap-3 p-3 max-w-[var(--form-max-content-width)] m-auto w-full h-full">
                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">${t("forms.channel_setting_link.link")}</span>
                            ${Inputs.create({
            placeholder: t("forms.channel_setting_link.link"),
            name: "link",
            attributes: ["required"],
            classes: ["font-mono"]
        })}
                            <span class="text-sm text-secondary">${t("forms.channel_setting_link.set_link_desc")}</span>
                        </div>
                    </div>

                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

    }

}
