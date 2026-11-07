// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Icons } from "../../utils/icons.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { Inputs } from "../../components/inputs.js";

// Импортируем handlers
import { createMainFolderHandler } from "./handlers/create.js";
import { t } from "../../utils/i18n/index.js";

/**
 * Настройки формы создания папки.
 */
export interface MainFolderCreateOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные формы создания папки.
 */
export interface MainFolderCreateData {

    /** Настройки формы. */
    options?: MainFolderCreateOptions;

}

// Form
export class MainFolderCreate {

    // Переменная для хранения единственного экземпляра формы
    static instance: MainFolderCreate | null = null;

    /** Настройки формы. */
    options: MainFolderCreateOptions;

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
     * @param data - Данные.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data?: MainFolderCreateData) {

        // Устанавливаем настройки
        this.options = {
            insertInto: document.querySelector(".cdm-form.home .left"),
            ...data?.options
        }

        // Проверяем, существует ли уже экземпляр
        if (MainFolderCreate.instance) {
            return MainFolderCreate.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        MainFolderCreate.instance = this;

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
                url: `?main-folder-create`,
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
            const create = this.tpl.querySelector(`:scope >.content [action-create]`);
            create?.addEventListener("click", () => createMainFolderHandler(this));

            // Создать по Enter в поле ввода (элемент — input, чтобы событие
            // keydown типизировалось как KeyboardEvent, а не Event)
            const input = this.tpl.querySelector<HTMLInputElement>(`:scope >.content [name="name"]`);
            input?.addEventListener("keydown", (event) => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    createMainFolderHandler(this);
                }
            });

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
            const content = this.tpl.querySelector<HTMLElement>(":scope >.content");
            this.content = content;

            // Инициализируем скролл (скролл-контейнер входит в шаблон)
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
    _onOpen(): void {

        this._handlers();

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Удаляем экземпляр формы
        MainFolderCreate.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement {

        // invariant: корневой .cdm-form входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`
        
            <div class="cdm-form main-folder-create flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "ArrowLeft" })}
                    <span class="font-semibold text-base truncate">${t("forms.main_folder_create.title")}</span>
                    <span class="w-10"></span>
                </div>
                 <div class="content w-full h-full flex ${CDM_FORM_CONTENT_CLASSES()}">

                    <div class="flex flex-col gap-3 p-3 max-w-[var(--form-max-content-width)] m-auto w-full">

                        <div class="flex flex-col gap-4 p-5 items-center text-center rounded-lg bg-[var(--second-bg)]">
                            <div class="flex items-center justify-center w-14 h-14 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                ${Icons.icon("folder-plus", { settings: { size: 28, stroke: 1.5 } })?.outerHTML ?? ""}
                            </div>
                            <div class="flex flex-col gap-1">
                                <span class="font-semibold">${t("forms.main_folder_create.title")}</span>
                                <span class="text-sm text-muted">${t("forms.main_folder_create.desc")}</span>
                            </div>
                        </div>

                        <div class="flex flex-col gap-2.5 p-4 rounded-lg bg-[var(--second-bg)]">
                            <span class="flex flex-row gap-2 items-center text-sm font-semibold">${t("forms.main_folder_create.name")}</span>
                            ${Inputs.create({
                                placeholder: t("forms.main_folder_create.name"),
                                name: "name",
                                attributes: ["required", "maxlength=128", "autofocus"]
                            })}
                        </div>

                        ${Buttons.primary({
                            classes: ["w-full"],
                            attributes: ["action-create"],
                            text: t("forms.main_folder_create.action_create"),
                            icon: "folder-plus"
                        })}

                    </div>
                    
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form")!;

    }

}
