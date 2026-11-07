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

// Импортируем forms
import { SecretChat } from "../../index.js";

// Импортируем handlers
import { removeHandler } from "./handlers/remove.js";

/**
 * Настройки диалога удаления.
 */
export interface RemoveChatOptions {

    /** Куда вставить диалог. */
    insertInto?: HTMLElement | null | undefined;

}

/**
 * Данные конструктора диалога удаления.
 */
export interface RemoveChatData {

    /** Id секретного чата. */
    chatId: string;

    /** Callback с ответом диалога. */
    callback: () => void;

    /** Настройки диалога. */
    options?: RemoveChatOptions;

}

// Form
export class RemoveChat {

    // Переменная для хранения единственного экземпляра формы
    static instance: RemoveChat | null = null;

    /**
     * ***************************************************************************
     * Диалог подтверждения удаления секретного чата. Чекбокса «для всех» нет:
     * удаление всегда двустороннее (control-кадр close удаляет чат у обоих).
     * @param data - Данные.
     * @param data.chatId - Id секретного чата.
     * @param data.callback - Callback.
     * @param data.options - Настройки диалога.
     * ***************************************************************************
     */
    constructor(data: RemoveChatData) {

        // Поиск открытой формы секретного чата
        let chatForm = SecretChat.instances?.get(data.chatId);
        let insertInto = chatForm?.modal?.content || null;

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

        // Проверяем, существует ли уже экземпляр
        if (RemoveChat.instance) {
            return RemoveChat.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        RemoveChat.instance = this;

        // Инициализация
        this._init();

    }

    // Настройки формы
    options: RemoveChatOptions;

    // Каркас: шаблон, модалка, контент, скролл
    tpl: HTMLElement | null;
    modal: Overlay | null;
    content: HTMLElement | null;
    osListScrollInstance: OverlayScrollbars | null;

    // Callback диалога
    callback: () => void;

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
        RemoveChat.instance = null;

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
                        ${window._lc.forms.secret_chat.dialogs.remove_chat_confirm.desc}
                    </span>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "x" })}
                </div>
                 <div class="${CDM_MODAL_CONTENT_CLASSES()}"></div>
                <div class="${CDM_MODAL_FOOTER_CLASSES()}">
                    ${Buttons.create({
            shape: "square",
            attributes: ["action-close"],
            classes: ["w-full"],
            text: window._lc.forms.secret_chat.dialogs.remove_chat_confirm.action_cancel
        })}
                    ${Buttons.danger({
            shape: "square",
            attributes: ["action-remove"],
            classes: ["w-full"],
            text: window._lc.forms.secret_chat.dialogs.remove_chat_confirm.action_remove
        })}
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-modal");

    }

}
