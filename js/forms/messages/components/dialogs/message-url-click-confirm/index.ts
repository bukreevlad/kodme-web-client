// Импортируем config
import { CDM_MODAL_CLASSES, CDM_MODAL_CONTENT_CLASSES, CDM_MODAL_FOOTER_CLASSES, CDM_MODAL_HEADER_CLASSES } from "../../../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../../../../components/overlay/index.js";
import { Buttons } from "../../../../../components/buttons.js";
import { t } from "../../../../../utils/i18n/index.js";

/**
 * Данные формы подтверждения перехода по внешней ссылке.
 */
export interface MessageUrlClickConfirmData {

    /** Ссылка. */
    url: string;

    /** Настройки формы. */
    options?: {

        /** Куда вставить форму. */
        insertInto?: HTMLElement | null;

    };

}

/**
 * ***************************************************************************
 * MessageUrlClickConfirm - форма подтверждения перехода по внешней ссылке
 * (защита от нежелательных переходов по клику в сообщении).
 * ***************************************************************************
 */
export class MessageUrlClickConfirm {

    /** Единственный экземпляр формы (Singleton). */
    static instance: MessageUrlClickConfirm | null = null;

    /** Настройки формы. */
    options: { insertInto?: HTMLElement | null };

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Ссылка. */
    url: string;

    /**
     * ***************************************************************************
     * Форма.
     * @param data - Данные (ссылка и настройки).
     * ***************************************************************************
     */
    constructor(data: MessageUrlClickConfirmData) {

        // Если не передан url
        if (!data?.url) throw new Error("Не передан: url");

        // Устанавливаем настройки
        this.options = {
            ...data?.options
        };

        // Переменные формы
        this.url = data.url;

        // Проверяем, существует ли уже экземпляр
        if (MessageUrlClickConfirm.instance) {
            return MessageUrlClickConfirm.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        MessageUrlClickConfirm.instance = this;

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
                onBeforeOpen: () => this._setup(),
                onOpen: () => this._handlers(),
                onBeforeClose: () => this._onClose()
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
            let close = this.tpl?.querySelector(":scope >.footer [action-close]");
            close?.addEventListener("click", () => this.modal?.close());

            // Открыть
            let open = this.tpl?.querySelector(":scope >.footer >[action-open]");
            open?.addEventListener("click", () => {

                // noopener/noreferrer — без них открытая страница получает
                // window.opener и сможет подменить нашу вкладку (window.opener.location).
                const opened = window.open(this.url, "_blank", "noopener,noreferrer");

                // В некоторых браузерах window.open возвращает null даже при успехе —
                // тогда принудительно разрываем связь с новым окном.
                if (opened) opened.opener = null;

                this.modal?.close();
            });

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Настройка формы
    // ***************************************************************************
    async _setup(): Promise<void> {

        try {

            // Устанавливаем элементы
            let url = this.tpl?.querySelector<HTMLElement>(":scope >.content [data-url]");

            // Записываем данные
            if (url) url.textContent = this.url;

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onClose(): void {

        // Удаляем экземпляр формы
        MessageUrlClickConfirm.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`
        
            <div class="cdm-modal message-url-click-confirm flex flex-col gap-0 ${CDM_MODAL_CLASSES()}">
                 <div class="${CDM_MODAL_HEADER_CLASSES()}">
                    <span class="font-semibold text-lg">${t("forms.messages.components.messages.dialogs.message_url_click_confirm.desc")}</span>
                </div>
                 <div class="${CDM_MODAL_CONTENT_CLASSES()} items-center">

                    <span data-url class="text-[var(--color-brand)] dark:text-[var(--color-brand)] font-mono text-sm"></span>
                    
                </div>
                <div class="${CDM_MODAL_FOOTER_CLASSES()}">
                    ${Buttons.create({
                        shape: "square",
                        attributes: ["action-close"],
                        classes: ["w-full"],
                        text: t("forms.messages.components.messages.dialogs.message_url_click_confirm.cancel")
                    })}
                    ${Buttons.primary({
                        shape: "square",
                        attributes: ["action-open"],
                        classes: ["w-full"],
                        text: t("forms.messages.components.messages.dialogs.message_url_click_confirm.open")
                    })}
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-modal");

    }

}
