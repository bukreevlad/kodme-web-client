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
import { Inputs } from "../../components/inputs.js";

// Импортируем forms
import { BotProfile } from "../bot-profile/index.js";

// Импортируем handlers
import { saveHandler } from "./handlers/save.js";

// Импортируем типы
import type { BotAppRecord } from "../bot-settings/types.js";

/**
 * Настройки диалога редактирования приложения.
 */
export interface EditBotAppOptions {

    /** Куда вставить диалог. */
    insertInto?: HTMLElement | null | undefined;

}

/**
 * Данные конструктора диалога редактирования приложения.
 */
export interface EditBotAppData {

    /** Id бота. */
    botId: string;

    /** Данные приложения бота. */
    app: BotAppRecord;

    /** Настройки формы. */
    options?: EditBotAppOptions;

}

// Form
export class EditBotApp {

    // Переменная для хранения единственного экземпляра формы
    static instance: EditBotApp | null = null;

    /**
     * ***************************************************************************
     * Диалог редактирования приложения бота.
     * @param data - Данные.
     * @param data.botId - Id бота.
     * @param data.app - Данные приложения бота.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: EditBotAppData) {

        // Если не переданы данные
        if (!data?.botId) throw new Error("Не передан: botId");
        if (!data?.app) throw new Error("Не передан: app");

        // Поиск открытого профиля бота: дочерняя форма (приложение, команда,
        // категория, ссылка) должна открыться внутри него. Если профиль
        // закрыт — остаётся левая колонка home
        const insertInto: HTMLElement | null = BotProfile.instances.get(data.botId)?.modal?.content
            || document.querySelector(".cdm-form.home .left");

        // Устанавливаем настройки
        this.options = {
            insertInto,
            ...data?.options
        }

        // Параметры
        this.app = data.app;

        // Переменные формы
        this.tpl = null;
        this.modal = null;
        this.content = null;
        this.osListScrollInstance = null; // overlayScroll instance

        // Проверяем, существует ли уже экземпляр
        if (EditBotApp.instance) {
            return EditBotApp.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        EditBotApp.instance = this;

        // Инициализация
        this._init();

    }

    // Настройки формы
    options: EditBotAppOptions;

    // Данные редактируемого приложения
    app: BotAppRecord;

    // Каркас: шаблон, модалка, контент
    tpl: HTMLElement | null;
    modal: Overlay | null;
    content: HTMLElement | null;
    osListScrollInstance: OverlayScrollbars | null;

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
                insertInto: this.options.insertInto,
                closeOnEsc: false,
                closeOnOverlay: false,
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: async () => await this._onOpen(),
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
            let name = this.tpl.querySelector<HTMLInputElement>(":scope >.content [name=name]");
            let link = this.tpl.querySelector<HTMLInputElement>(":scope >.content [name=link]");
            let about = this.tpl.querySelector<HTMLInputElement>(":scope >.content [name=about]");
            let url = this.tpl.querySelector<HTMLInputElement>(":scope >.content [name=url]");

            // Поля обязаны входить в шаблон — иначе заполнять нечего
            if (!name || !link || !about || !url) return;

            // Показываем данные (link/about опциональны — нормализуем, чтобы
            // в поле не «утекало» null)
            name.value = this.app?.name;
            link.value = this.app?.link ?? "";
            about.value = this.app?.about ?? "";
            url.value = this.app?.url;

            // Инициализируем скролл
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
    async _onOpen(): Promise<void> {

        // Устанавливаем обработчики
        this._handlers();

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Удаляем экземпляр формы
        EditBotApp.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`

            <div class="cdm-form bot-edit-app flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "ArrowLeft" })}
                    <span class="flex-1 font-semibold text-base truncate">${window._lc.forms.bot_settings.dialogs.edit_app.title}</span>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-save"], icon: "device-floppy" })}
                </div>
                 <div class="content w-full h-full flex ${CDM_FORM_CONTENT_CLASSES()}">
                    <div class="flex flex-col gap-3 p-3 max-w-[var(--form-max-content-width)] m-auto w-full">

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("label", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.bot_settings.dialogs.edit_app.name}
                            </span>
                            ${Inputs.create({ placeholder: window._lc.forms.bot_settings.dialogs.edit_app.name, name: "name" })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("link", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.bot_settings.dialogs.edit_app.link}
                            </span>
                            ${Inputs.create({ placeholder: window._lc.forms.bot_settings.dialogs.edit_app.link, name: "link" })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("message-circle", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.bot_settings.dialogs.edit_app.about}
                            </span>
                            ${Inputs.textarea({ placeholder: window._lc.forms.bot_settings.dialogs.edit_app.about, name: "about", rows: 4 })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("external-link", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.bot_settings.dialogs.edit_app.url}
                            </span>
                            ${Inputs.create({ placeholder: window._lc.forms.bot_settings.dialogs.edit_app.url, name: "url" })}
                        </div>

                    </div>
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

    }

}
