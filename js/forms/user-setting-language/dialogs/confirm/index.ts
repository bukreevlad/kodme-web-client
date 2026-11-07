// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_MODAL_CLASSES, CDM_MODAL_CONTENT_CLASSES, CDM_MODAL_FOOTER_CLASSES, CDM_MODAL_HEADER_CLASSES } from "../../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { t } from "../../../../utils/i18n/index.js";

// Импортируем components
import { Overlay } from "../../../../components/overlay/index.js";
import { Buttons } from "../../../../components/buttons.js";

/**
 * Настройки диалога подтверждения смены языка.
 */
export interface ConfirmLanguageChangeOptions {

    /** Куда вставить диалог. */
    insertInto?: HTMLElement | null | undefined;

}

/**
 * Данные диалога подтверждения смены языка.
 */
export interface ConfirmLanguageChangeData {

    /** Отображаемое имя языка (для текста подтверждения). */
    name: string;

    /** Настройки формы. */
    options?: ConfirmLanguageChangeOptions;

    /** Callback, вызываемый с флагом подтверждения. */
    callback: (confirmed: boolean) => void;

}

// Form
export class ConfirmLanguageChange {

    // Переменная для хранения единственного экземпляра формы
    static instance: ConfirmLanguageChange | null = null;

    /** Отображаемое имя языка. */
    name: string;

    /** Callback с флагом подтверждения. */
    callback: (confirmed: boolean) => void;

    // Каркас: шаблон, модалка, контент и instance скролла
    options: ConfirmLanguageChangeOptions;
    tpl: HTMLElement | null;
    modal: Overlay | null;
    content: HTMLElement | null;
    osListScrollInstance: OverlayScrollbars | null;

    /**
     * ***************************************************************************
     * Диалог подтверждения смены языка.
     * @param data - Данные.
     * @param data.name - Отображаемое имя языка.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить диалог.
     * @param data.callback - Callback.
     * ***************************************************************************
     */
    constructor(data: ConfirmLanguageChangeData) {

        // Если не передано имя языка
        if (!data?.name) throw new Error("Не передано: name");

        // Устанавливаем настройки
        this.options = {
            insertInto: data.options?.insertInto,
            ...data?.options
        }

        // Переменные формы
        this.name = data.name;
        this.callback = data.callback;
        this.tpl = null;
        this.modal = null;
        this.content = null;
        this.osListScrollInstance = null;

        // Проверяем, существует ли уже экземпляр
        if (ConfirmLanguageChange.instance) {
            return ConfirmLanguageChange.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        ConfirmLanguageChange.instance = this;

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
                type: "modal",
                insertInto: this.options.insertInto,
                closeOnEsc: true,
                closeOnOverlay: true,
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

            // Отмена (и крестик в шапке)
            const cancel = this.tpl.querySelectorAll<HTMLElement>(":scope [action-close]");
            cancel.forEach((button) => button.addEventListener("click", () => this.callback(false)));

            // Сменить
            const change = this.tpl.querySelector<HTMLElement>(":scope >.footer [action-change]");
            change?.addEventListener("click", () => this.callback(true));

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
    async _onOpen(): Promise<void> {

        // Устанавливаем обработчики
        this._handlers();

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Удаляем экземпляр формы
        ConfirmLanguageChange.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement {

        // invariant: корневой .cdm-modal входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`

            <div class="cdm-modal user-setting-language-confirm flex flex-col p-0 gap-0 ${CDM_MODAL_CLASSES()}">
                <div class="${CDM_MODAL_HEADER_CLASSES()}">
                    <span class="flex flex-row gap-2 items-center font-semibold text-lg">${t("forms.user_setting_language.dialogs.confirm.title")}</span>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "x" })}
                </div>
                 <div class="${CDM_MODAL_CONTENT_CLASSES()}">

                        <span class="text-secondary text-sm">${t("forms.user_setting_language.dialogs.confirm.desc", { name: this.name })}</span>

                </div>
                <div class="${CDM_MODAL_FOOTER_CLASSES()}">
                    ${Buttons.create({ attributes: ["action-close"], classes: ["w-full"], text: t("forms.user_setting_language.dialogs.confirm.action_cancel") })}
                    ${Buttons.primary({ attributes: ["action-change"], classes: ["w-full"], text: t("forms.user_setting_language.dialogs.confirm.action_change") })}
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-modal")!;

    }

}
