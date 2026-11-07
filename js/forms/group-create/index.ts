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
import { Toggle } from "../../components/toggle.js";

// Импортируем handlers
import { createHandler } from "./handlers/create.js";
import { t } from "../../utils/i18n/index.js";

/**
 * Настройки формы создания группы.
 */
export interface GroupCreateOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

// Form
export class GroupCreate {

    // Переменная для хранения единственного экземпляра формы
    static instance: GroupCreate | null = null;

    // Настройки формы
    options: GroupCreateOptions;

    // Каркас: шаблон, модалка, контент и instance скролла
    tpl: HTMLElement | null;
    modal: Overlay | null;
    content: HTMLElement | null;
    osListScrollInstance: OverlayScrollbars | null;

    /**
     * ***************************************************************************
     * Форма создания группы.
     * @param options - Настройки формы.
     * @param options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(options: GroupCreateOptions = {}) {

        // Устанавливаем настройки
        this.options = {
            insertInto: document.querySelector(".cdm-form.home .left"),
            ...options
        }

        // Переменные формы
        this.tpl = null;
        this.modal = null;
        this.content = null;
        this.osListScrollInstance = null; // overlayScroll instance

        // Проверяем, существует ли уже экземпляр
        if (GroupCreate.instance) {
            return GroupCreate.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        GroupCreate.instance = this;

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
                url: `?group-create`,
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

            // Создать
            let create = this.tpl.querySelector(":scope >.header [action-create]");
            create?.addEventListener("click", () => createHandler(this));

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

            // Инициализируем скролл (скролл-контейнер входит в шаблон)
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
        GroupCreate.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`

            <div class="cdm-form group-create flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full">
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
            attributes: ["action-create"],
            icon: "device-floppy"
        })}
                </div>
                 <div class="content w-full h-full flex ${CDM_FORM_CONTENT_CLASSES()}">

                    <div class="flex flex-col gap-3 p-3 max-w-[var(--form-max-content-width)] m-auto w-full">

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("label", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.group_create.name")}
                            </span>
                            ${Inputs.create({
            placeholder: t("forms.group_create.name"),
            name: "name",
            attributes: ["required"],
        })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("message-circle", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.group_create.about")}
                            </span>
                            ${Inputs.textarea({
            placeholder: t("forms.group_create.about"),
            name: "about",
            attributes: ["required"],
        })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("world", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.group_create.type")}
                            </span>
                            <span class="text-sm text-secondary">${t("forms.group_create.type_desc")}</span>
                            ${Toggle.switch({
            name: "is-public",
            checked: true,
            toggleText: {
                on: t("forms.group_create.opened"),
                off: t("forms.group_create.closed")
            }
        })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("pencil", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.group_create.can_posting")}
                            </span>
                            <span class="text-sm text-secondary">${t("forms.group_create.can_posting_desc")}</span>
                            ${Toggle.switch({
            name: "is-posting",
            checked: false,
            toggleText: {
                on: t("forms.group_create.all_posting"),
                off: t("forms.group_create.admin_posting")
            }
        })}
                        </div>

                    </div>

                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

    }

}
