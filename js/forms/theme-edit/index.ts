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
import { saveHandler } from "./handlers/save.js";

// Импортируем requests
import { getThemeInfoRequest } from "./requests/get_theme_info.js";

// Импортируем типы
import type { ThemeInfo } from "./requests/get_theme_info.js";

/**
 * Настройки формы редактирования темы.
 */
export interface ThemeEditOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные конструктора формы.
 */
export interface ThemeEditData {

    /** Id темы. */
    themeId: string;

    /** Настройки формы. */
    options?: ThemeEditOptions;

}

// Form
export class ThemeEdit {

    // Реестр всех открытых форм ThemeEdit: { themeId: instance }
    static instances = new Map<string, ThemeEdit>();

    /** Настройки формы. */
    options: ThemeEditOptions;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Id темы. */
    themeId: string;

    /** Данные темы (ответ "[theme]: get info"). */
    theme: ThemeInfo | null = null;

    /** Контент формы. */
    content: HTMLElement | null = null;

    /** Поле стилей темы ([name="styles"]). */
    styles: HTMLTextAreaElement | null = null;

    /**
     * ***************************************************************************
     * Форма.
     * @param data - Данные.
     * @param data.themeId - Id темы.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: ThemeEditData) {

        // Если не передан themeId
        if (!data?.themeId) throw new Error("Не передан: themeId");

        // Устанавливаем настройки
        this.options = {
            insertInto: document.querySelector<HTMLElement>(".cdm-form.home .middle >.form-container"),
            ...data?.options
        }

        // Переменные формы
        this.themeId = data.themeId;

        // Получаем instance
        let instance = ThemeEdit.instances.get(data.themeId);
        if (instance) return instance;

        // Регистрируем этот экземпляр формы
        ThemeEdit.instances.set(this.themeId, this);

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
                url: `?theme-edit=${this.themeId}`,
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
            this.content = this.tpl.querySelector<HTMLElement>(":scope >.content");

            // Получаем тему
            let response = await getThemeInfoRequest({
                theme_id: this.themeId
            });

            // Записываем данные
            this.theme = response.data;

            // Определяем textarea
            this.styles = this.tpl.querySelector<HTMLTextAreaElement>(`[name="styles"]`);

            // Активируем переключатели
            Toggle.hydrate(this.tpl);

            // Обновляем форму
            this._update(this.theme);

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
    // ***************************************************************************
    _update(data: ThemeInfo): void {

        // Элементы заполняются из шаблона — без него нечего обновлять
        if (!this.tpl) return;

        // Устанавливаем элементы
        let name = this.tpl.querySelector<HTMLInputElement>(`:scope >.content [name="name"]`);
        let isPublic = this.tpl.querySelector<HTMLInputElement>(`:scope >.content [name="is-public"]`);

        // Поля обязаны входить в шаблон, textarea задаётся в _onBeforeOpen —
        // иначе обновлять нечего
        const styles = this.styles;
        if (!name || !isPublic || !styles) return;

        // Отображаем данные
        name.value = data.name;
        styles.value = data.style;
        data.is_public && isPublic.click();

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Удаляем экземпляр формы из реестра
        ThemeEdit.instances.delete(this.themeId);

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement {

        // invariant: корневой .cdm-form входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`
        
            <div class="cdm-form theme-edit flex flex-col gap-0 w-full h-full ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.circle({ intent: "transparent", attributes: ["action-close"], icon: "ArrowLeft" })}
                    ${Buttons.circle({ intent: "transparent", attributes: ["action-save"], icon: "device-floppy" })}
                </div>
                 <div class="content w-full flex ${CDM_FORM_CONTENT_CLASSES()}">

                    <div class="flex flex-col gap-3 p-3 max-w-[var(--form-max-content-width)] m-auto w-full">

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("label", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.theme_edit.name}
                            </span>
                            ${Inputs.create({ placeholder: window._lc.forms.theme_edit.name, name: "name" })}
                            
                            ${Toggle.switch({
                                name: "is-public", checked: false,
                                toggleText: {
                                    on: window._lc.forms.theme_edit.opened,
                                    off: window._lc.forms.theme_edit.closed
                                }
                            })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("palette", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.theme_edit.style}
                            </span>
                            ${Inputs.textarea({ placeholder: window._lc.forms.theme_create.style, name: "styles", rows: 4 })}
                        </div>

                    </div>

                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form")!;

    }

}
