// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_MODAL_CLASSES, CDM_MODAL_CONTENT_CLASSES, CDM_MODAL_FOOTER_CLASSES, CDM_MODAL_HEADER_CLASSES } from "../../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { Icons } from "../../../../utils/icons.js";

// Импортируем components
import { Overlay } from "../../../../components/overlay/index.js";
import { Buttons } from "../../../../components/buttons.js";
import { Toggle } from "../../../../components/toggle.js";

// Импортируем forms
import { Messages } from "../../index.js";

// Импортируем handlers
import { removeHandler } from "./handlers/remove.js";
import { t } from "../../../../utils/i18n/index.js";

/**
 * Настройки диалога удаления.
 */
export interface RemoveDialogOptions {

    /** Куда вставить диалог. */
    insertInto?: HTMLElement | null | undefined;

}

/**
 * Ответ диалога удаления.
 */
export interface RemoveDialogResult {

    /** Удалить для всех участников. */
    for_all: boolean;

}

/**
 * Данные конструктора диалога удаления.
 */
export interface RemoveDialogData {

    /** Id канала. */
    channelId: string;

    /** Показывать checkbox «удалить для всех»? */
    forAllCheckbox?: boolean;

    /** Callback с ответом диалога. */
    callback: (data: RemoveDialogResult) => void;

    /** Настройки диалога. */
    options?: RemoveDialogOptions;

}

// Form
export class RemoveDialog {

    // Переменная для хранения единственного экземпляра формы
    static instance: RemoveDialog | null = null;

    /**
     * ***************************************************************************
     * Диалог подтверждения удаления диалога.
     * @param data - Данные.
     * @param data.channelId - Id канала.
     * @param data.forAllCheckbox - Показывать checkbox «удалить для всех».
     * @param data.callback - Callback.
     * @param data.options - Настройки диалога.
     * ***************************************************************************
     */
    constructor(data: RemoveDialogData) {

        // Поиск открытой формы сообщений
        let messageForm = Messages.instances?.get(data.channelId);
        let insertInto = messageForm?.modal?.content || null;

        // Устанавливаем настройки
        this.options = {
            insertInto: insertInto || data.options?.insertInto,
            ...data?.options
        }

        // Переменные формы
        this.tpl = null;
        this.modal = null;
        this.content = null;
        this.osListScrollInstance = null; // overlayScroll instance

        // Переменные формы
        this.callback = data.callback;
        this.forAllCheckbox = data?.forAllCheckbox || false;

        // Проверяем, существует ли уже экземпляр
        if (RemoveDialog.instance) {
            return RemoveDialog.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        RemoveDialog.instance = this;

        // Инициализация
        this._init();

    }

    // Настройки формы
    options: RemoveDialogOptions;

    // Каркас: шаблон, модалка, контент, скролл
    tpl: HTMLElement | null;
    modal: Overlay | null;
    content: HTMLElement | null;
    osListScrollInstance: OverlayScrollbars | null;

    // Callback и флаг checkbox «удалить для всех»
    callback: (data: RemoveDialogResult) => void;
    forAllCheckbox: boolean;

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

            // Закрыть из шапки
            let headerClose = this.tpl.querySelector(":scope >.header [action-close]");
            headerClose?.addEventListener("click", () => this.modal?.close());

            // Удалить
            let remove = this.tpl.querySelector(":scope >.footer [action-remove]");
            remove?.addEventListener("click", () => removeHandler(this));

            // Отмена
            let close = this.tpl.querySelector(":scope >.footer [action-close]");
            close?.addEventListener("click", () => this.modal?.close());

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
            let forAllCheckbox = this.tpl.querySelector(":scope >.content [data-for-all]");

            // Если чекбокс отключен — прячем его строку целиком (она входит в шаблон)
            if (!this.forAllCheckbox && forAllCheckbox) forAllCheckbox.classList.add("hidden");

            // Инициализируем скролл (скролл-контейнер входит в шаблон)
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
        RemoveDialog.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`

            <div class="cdm-modal remove-dialog flex flex-col p-0 gap-0 ${CDM_MODAL_CLASSES()}">
                 <div class="${CDM_MODAL_HEADER_CLASSES()}">
                    <span class="flex flex-row gap-2 items-center font-semibold text-lg">
                        <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                            ${Icons.icon("trash", { settings: { size: 20 } })?.outerHTML ?? ""}
                        </span>
                        ${t("forms.messages.dialogs.remove_dialog_confirm.desc")}
                    </span>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "x" })}
                </div>
                 <div class="${CDM_MODAL_CONTENT_CLASSES()}">

                    <div data-for-all class="flex flex-col gap-2">
                        ${Toggle.checkbox({
            name: "for-all",
            checked: false,
            text: t("forms.messages.dialogs.remove_dialog_confirm.for_all")
        })}
                    </div>

                </div>
                <div class="${CDM_MODAL_FOOTER_CLASSES()}">
                    ${Buttons.create({
            shape: "square",
            attributes: ["action-close"],
            classes: ["w-full"],
            text: t("forms.messages.dialogs.remove_dialog_confirm.action_cancel")
        })}
                    ${Buttons.danger({
            shape: "square",
            attributes: ["action-remove"],
            classes: ["w-full"],
            text: t("forms.messages.dialogs.remove_dialog_confirm.action_remove")
        })}
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-modal");

    }

}
