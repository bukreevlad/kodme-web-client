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
import { createBotHandler } from "./handlers/create.js";
import { t } from "../../utils/i18n/index.js";

/**
 * Настройки формы создания бота.
 */
export interface BotCreateOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null | undefined;

}

// Form
export class BotCreate {

    // Переменная для хранения единственного экземпляра формы
    static instance: BotCreate | null = null;

    /** Настройки формы. */
    options: BotCreateOptions;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Контент формы (скролл-контейнер OverlayScrollbars). */
    content: HTMLElement | null = null;

    /** Инстанс OverlayScrollbars списка. */
    osListScrollInstance: OverlayScrollbars | null = null;

    /**
     * ***************************************************************************
     * Форма.
     * @param options - Настройки формы.
     * @param options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(options?: BotCreateOptions) {

        // Устанавливаем настройки. Форма живёт в левой колонке home —
        // как и group-create, даже если вызывающий не передал insertInto
        this.options = {
            insertInto: document.querySelector(".cdm-form.home .left"),
            ...options
        }

        // Проверяем, существует ли уже экземпляр
        if (BotCreate.instance) {
            return BotCreate.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        BotCreate.instance = this;

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
                url: `?bot-create`,
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
            const close = this.tpl.querySelector(`:scope >.header [action-close]`);
            close?.addEventListener("click", () => this.modal?.close());

            // Создать
            const create = this.tpl.querySelector(`:scope >.header [action-create]`);
            create?.addEventListener("click", () => createBotHandler(this));

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
        BotCreate.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement {

        // invariant: корневой .cdm-form входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`
        
            <div class="cdm-form bot-create flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full">
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
                                    ${Icons.icon("link", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.bot_create.link")}
                            </span>
                            ${Inputs.create({
                                placeholder: t("forms.broadcast_create.name"),
                                name: "link",
                                attributes: ["required"],
                                classes: ["font-mono"]
                            })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("message-circle", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.bot_create.bio")}
                            </span>
                            ${Inputs.textarea({
                                placeholder: t("forms.bot_create.bio"),
                                name: "bio"
                            })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("world", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.bot_create.private_type")}
                            </span>
                            <span class="text-sm text-secondary">${t("forms.bot_create.private_type_desc")}</span>
                            ${Toggle.switch({
                                name: "is-public",
                                checked: true,
                                toggleText: {
                                    on: t("forms.bot_create.opened"),
                                    off: t("forms.bot_create.closed")
                                }
                            })}
                        </div>

                    </div>
                    
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form")!;

    }

}
