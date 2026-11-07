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
import { themeCreateHandler } from "./handlers/create.js";
import { t } from "../../utils/i18n/index.js";

/**
 * Настройки формы создания темы.
 */
export interface ThemeCreateOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

// Form
export class ThemeCreate {

    // Переменная для хранения единственного экземпляра формы
    static instance: ThemeCreate | null = null;

    /** Настройки формы. */
    options: ThemeCreateOptions;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Контент формы. */
    content: HTMLElement | null = null;

    /** Поле ввода CSS-стилей темы. */
    styles: HTMLTextAreaElement | null = null;

    /**
     * ***************************************************************************
     * Форма.
     * @param options - Настройки формы.
     * @param options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(options?: ThemeCreateOptions) {

        // Устанавливаем настройки
        this.options = {
            insertInto: document.querySelector(".cdm-form.home .middle >.form-container"),
            ...options
        }

        // Проверяем, существует ли уже экземпляр
        if (ThemeCreate.instance) {
            return ThemeCreate.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        ThemeCreate.instance = this;

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
                url: `?theme-create`,
                insertInto: this.options.insertInto,
                closeOnEsc: false,
                closeOnOverlay: false,
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: () => this._onOpen(),
                onBeforeClose: () => this._onBeforeClose(),
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
            create?.addEventListener("click", () => themeCreateHandler(this));

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

            // Определяем textarea
            this.styles = this.tpl.querySelector(`[name="styles"]`);

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
        ThemeCreate.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement {

        // invariant: корневой .cdm-form входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`
        
            <div class="cdm-form theme-create flex flex-col gap-0 w-full h-full ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.circle({ intent: "transparent", attributes: ["action-close"], icon: "ArrowLeft" })}
                    ${Buttons.circle({ intent: "transparent", attributes: ["action-create"], icon: "device-floppy" })}
                </div>
                 <div class="content w-full flex ${CDM_FORM_CONTENT_CLASSES()}">

                    <div class="flex flex-col gap-3 p-3 max-w-[var(--form-max-content-width)] m-auto w-full">

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("label", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.theme_create.name")}
                            </span>
                            ${Inputs.create({ placeholder: t("forms.theme_create.name"), name: "name" })}

                            ${Toggle.switch({
                                name: "is-public", checked: false,
                                toggleText: {
                                    on: t("forms.theme_create.opened"),
                                    off: t("forms.theme_create.closed")
                                }
                            })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("palette", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.theme_create.style")}
                            </span>
                            ${Inputs.textarea({ placeholder: t("forms.theme_create.style"), name: "styles", rows: 4 })}
                        </div>

                    </div>

                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form")!;

    }

}
