// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES, CDM_FORM_SECTION_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Icons } from "../../utils/icons.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { Inputs } from "../../components/inputs.js";
import { Toggle } from "../../components/toggle.js";

// Импортируем handlers
import { createHandler } from "./handlers/create.js";

// Импортируем functions
import { fullLink } from "../cloud/functions/full_link.js";

// Импортируем типы
import type { Cloud } from "../cloud/index.js";
import type { CloudItem, CloudShareLinkRow } from "../cloud/types.js";

/**
 * Настройки диалога создания ссылки.
 */
export interface CreateShareLinkOptions {

    /** Куда вставить диалог. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные конструктора диалога.
 */
export interface CreateShareLinkData {

    /** Экземпляр формы облака. */
    form: Cloud;

    /** Папка или файл, для которого создаётся ссылка. */
    item: CloudItem;

    /** Настройки диалога. */
    options?: CreateShareLinkOptions;

}

// Form
export class CreateShareLink {

    // Переменная для хранения единственного экземпляра формы
    static instance: CreateShareLink | null = null;

    /**
     * ***************************************************************************
     * Форма создания ссылки-приглашения.
     * @param data - Данные.
     * @param data.form - Экземпляр формы облака.
     * @param data.item - Папка или файл, для которого создаётся ссылка.
     * @param data.options - Настройки формы.
     * ***************************************************************************
     */
    constructor(data: CreateShareLinkData) {

        // Если не передан form или item
        if (!data?.form) throw new Error("Не передан: form");
        if (!data?.item) throw new Error("Не передан: item");

        // Устанавливаем настройки. Форма живёт в левой колонке home —
        // как и group-create, а не поверх всего документа
        this.options = {
            insertInto: document.querySelector(".cdm-form.home .left"),
            ...data?.options
        }

        // Переменные формы
        this.tpl = null;
        this.modal = null;

        // Переменные формы
        this.form = data.form;
        this.item = data.item;

        // Проверяем, существует ли уже экземпляр
        if (CreateShareLink.instance) {
            return CreateShareLink.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        CreateShareLink.instance = this;

        // Инициализация
        this._init();

    }

    // Настройки формы
    options: CreateShareLinkOptions;

    // Каркас: шаблон и модалка
    tpl: HTMLElement | null = null;
    modal: Overlay | null = null;

    // Экземпляр формы облака и элемент, на который создаётся ссылка
    form: Cloud;
    item: CloudItem;

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

            // Закрыть
            let close = this.tpl?.querySelector(":scope >.header [action-close]");
            close?.addEventListener("click", () => this.modal?.close());

            // Создать ссылку
            let create = this.tpl?.querySelector(":scope >.header [action-create]");
            create?.addEventListener("click", () => createHandler(this));

            // Копировать ссылку
            let copy = this.tpl?.querySelector(":scope [action-copy]");
            copy?.addEventListener("click", () => this._copyLink());

            // Готово (закрыть после создания ссылки)
            let done = this.tpl?.querySelector(":scope [action-done]");
            done?.addEventListener("click", () => this.modal?.close());

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Форма открылась
    // ***************************************************************************
    _onOpen(): void {

        // Устанавливаем обработчики
        this._handlers();

    }

    // ***************************************************************************
    // Показ результата создания ссылки
    // @param linkData - Данные созданной ссылки.
    // ***************************************************************************
    _showResult(linkData: CloudShareLinkRow): void {

        // Элементы задаются шаблоном — без него нечего показывать
        if (!this.tpl) return;

        // Переключаем видимость секций
        this.tpl.querySelector(":scope [data-form]")?.classList.add("hidden");
        this.tpl.querySelector(":scope [data-result]")?.classList.remove("hidden");

        // Выводим значение ссылки (полный адрес с доменом)
        let linkInput = this.tpl.querySelector<HTMLInputElement>(":scope [name='link']");
        if (linkInput) {
            linkInput.value = fullLink(linkData?.link) || "";
        }

    }

    // ***************************************************************************
    // Копирование ссылки в буфер обмена
    // ***************************************************************************
    async _copyLink(): Promise<void> {

        try {

            // Элементы задаются шаблоном — без него нечего копировать
            if (!this.tpl) return;

            // Значение ссылки
            let linkInput = this.tpl.querySelector<HTMLInputElement>(":scope [name='link']");
            let link = linkInput?.value || "";

            // Если ссылки нет — выходим
            if (!link) return;

            // Копируем в буфер обмена
            await navigator.clipboard.writeText(link);

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Удаляем экземпляр формы
        CreateShareLink.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`

            <div class="cdm-form cloud-create-share-link flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "ArrowLeft" })}
                    <span class="flex-1 font-semibold text-base truncate">${window._lc.forms.cloud.dialogs.create_share_link.title}</span>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-create"], icon: "device-floppy" })}
                </div>

                <div data-form class="w-full flex flex-col gap-3">
                    <div class="content w-full h-full flex ${CDM_FORM_CONTENT_CLASSES()}">
                        <div class="flex flex-col gap-3 p-3 max-w-[var(--form-max-content-width)] m-auto w-full">
                        <span class="text-secondary text-sm truncate">${window._lc.forms.cloud.dialogs.create_share_link.item_name}: ${this.item?.name || ""}</span>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("lock-open", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.cloud.dialogs.create_share_link.access}
                            </span>
                            ${Toggle.cardGroup([
                                { name: "access_level", value: "read", text: window._lc.forms.cloud.dialogs.create_share_link.access_read, checked: true },
                                { name: "access_level", value: "write", text: window._lc.forms.cloud.dialogs.create_share_link.access_write }
                            ])}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("clock", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.cloud.dialogs.create_share_link.expires}
                            </span>
                            ${Inputs.create({ type: "datetime-local", name: "expires_at" })}
                        </div>

                        <span class="text-secondary text-xs">${window._lc.forms.cloud.dialogs.create_share_link.desc}</span>
                        </div>
                    </div>
                </div>

                <div data-result class="hidden w-full flex-col gap-3 p-3">
                    <div class="content w-full h-full flex ${CDM_FORM_CONTENT_CLASSES()}">
                        <div class="flex flex-col gap-3 max-w-[var(--form-max-content-width)] m-auto w-full">
                            <span class="text-secondary text-sm">${window._lc.forms.cloud.dialogs.create_share_link.link_result}</span>
                            ${Inputs.create({ name: "link", attributes: ["readonly"] })}
                        </div>
                    </div>
                    <div class="flex flex-row gap-2">
                        ${Buttons.create({ classes: ["w-full"], attributes: ["action-copy"], text: window._lc.forms.cloud.dialogs.create_share_link.action_copy })}
                        ${Buttons.primary({ classes: ["w-full"], attributes: ["action-done"], text: window._lc.forms.cloud.dialogs.create_share_link.action_close })}
                    </div>
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

    }

}
