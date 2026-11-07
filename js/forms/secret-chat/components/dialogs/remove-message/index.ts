// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_MODAL_CLASSES, CDM_MODAL_CONTENT_CLASSES, CDM_MODAL_FOOTER_CLASSES, CDM_MODAL_HEADER_CLASSES } from "../../../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../../../../components/overlay/index.js";
import { Buttons } from "../../../../../components/buttons.js";

// Импортируем forms
import { SecretChat } from "../../../../secret-chat/index.js";

// Импортируем handlers
import { removeHandler } from "./handlers/remove.js";
import { t } from "../../../../../utils/i18n/index.js";

/**
 * Данные формы удаления сообщения.
 */
export interface RemoveMessageDialogData {

    /** Id секретного чата. */
    chatId?: string | undefined;

    /** Настройки формы. */
    options?: {

        /** Куда вставить форму. */
        insertInto?: HTMLElement | null;

    };

    /** Ответ диалога вызывающему коду. */
    callback?: (() => void) | undefined;

}

/**
 * ***************************************************************************
 * RemoveMessage - диалог подтверждения удаления сообщения секретного чата.
 * Чекбокса «для всех» нет: удаление в секретном чате всегда зеркальное
 * (control-кадр msg_remove удаляет сообщение на обоих устройствах).
 * ***************************************************************************
 */
export class RemoveMessage {

    /** Единственный экземпляр формы (Singleton). */
    static instance: RemoveMessage | null = null;

    /** Настройки формы. */
    options: { insertInto?: HTMLElement | null | undefined };

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Контейнер контента (прокрутка содержимого). */
    content: HTMLElement | null = null;

    /** Экземпляр OverlayScrollbars. */
    osListScrollInstance: OverlayScrollbars | null = null;

    /** Ответ диалога вызывающему коду. */
    callback?: (() => void) | undefined;

    /**
     * ***************************************************************************
     * Форма.
     * @param data - Данные (чат, настройки, callback).
     * ***************************************************************************
     */
    constructor(data: RemoveMessageDialogData) {

        // Поиск открытой формы секретного чата (id чата опционален —
        // без него искать по реестру нечего)
        let chatForm = data.chatId != null ? SecretChat.instances.get(data.chatId) : undefined;
        let insertInto = chatForm?.modal?.content || null;

        // Устанавливаем настройки
        this.options = {
            insertInto: insertInto || data.options?.insertInto,
            ...data?.options
        };

        // Переменные формы
        this.callback = data.callback;

        // Проверяем, существует ли уже экземпляр
        if (RemoveMessage.instance) {
            return RemoveMessage.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        RemoveMessage.instance = this;

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
            this.content = this.tpl.querySelector<HTMLElement>(":scope >.content");

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
        RemoveMessage.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        // invariant: корневой .cdm-modal входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`

            <div class="cdm-modal remove-message flex flex-col p-0 gap-0 ${CDM_MODAL_CLASSES()}">
                 <div class="${CDM_MODAL_HEADER_CLASSES()}">
                    <span class="flex flex-row gap-2 items-center font-semibold text-lg">${t("forms.secret_chat.dialogs.remove_message_confirm.desc")}</span>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "x" })}
                </div>
                 <div class="${CDM_MODAL_CONTENT_CLASSES()}"></div>
                <div class="${CDM_MODAL_FOOTER_CLASSES()}">
                    ${Buttons.create({
                        shape: "square",
                        attributes: ["action-close"],
                        classes: ["w-full"],
                        text: t("forms.secret_chat.dialogs.remove_message_confirm.action_cancel")
                    })}
                    ${Buttons.danger({
                        shape: "square",
                        attributes: ["action-remove"],
                        classes: ["w-full"],
                        text: t("forms.secret_chat.dialogs.remove_message_confirm.action_remove")
                    })}
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-modal");

    }

}
