// Импортируем config
import { CDM_MODAL_CLASSES, CDM_MODAL_CONTENT_CLASSES, CDM_MODAL_FOOTER_CLASSES, CDM_MODAL_HEADER_CLASSES } from "../../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../../../components/overlay/index.js";
import { Buttons } from "../../../../components/buttons.js";

// Импортируем типы
import type { AppPermission } from "../../../../bot-app-sdk.js";

/** Маппинг типа доступа к ключу локали. */
const PERMISSION_LOCALE_KEYS: Record<AppPermission, "camera" | "microphone" | "geolocation" | "clipboard_write"> = {
    camera: "camera",
    microphone: "microphone",
    geolocation: "geolocation",
    "clipboard-write": "clipboard_write"
};

/**
 * Настройки диалога подтверждения доступа к устройству.
 */
export interface PermissionDialogOptions {

    /** Тип запрашиваемого доступа. */
    permission: AppPermission;

    /** Название приложения. */
    app_name: string;

    /** Куда вставить диалог. */
    insertInto?: HTMLElement | null | undefined;

    /** Решение пользователя (true — разрешено, false — отказано). */
    callback?: ((granted: boolean) => void | Promise<void>) | null;

}

// Form
export class PermissionDialog {

    /** Единственный экземпляр диалога. */
    static instance: PermissionDialog | null = null;

    /** Настройки диалога. */
    options: PermissionDialogOptions;

    /** Шаблон диалога. */
    tpl: HTMLElement | null = null;

    /** Модальное окно диалога. */
    modal: Overlay | null = null;

    /** Решение принято кнопкой (закрытие без кнопок — отказ). */
    private _decided = false;

    /**
     * ***************************************************************************
     * Диалог подтверждения доступа к устройству для WebApp-приложения.
     * @param data - Данные (тип доступа, приложение, решение пользователя).
     * ***************************************************************************
     */
    constructor(data: PermissionDialogOptions) {

        // Устанавливаем настройки
        this.options = {
            ...data
        };

        // Проверяем, существует ли уже экземпляр
        if (PermissionDialog.instance) {
            return PermissionDialog.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        PermissionDialog.instance = this;

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

            // Модальное окно
            this.modal = new Overlay(this.tpl, {
                type: "modal",
                insertInto: this.options.insertInto,
                closeOnEsc: true,
                closeOnOverlay: true,
                onBeforeOpen: () => this._setup(),
                onOpen: () => this._handlers(),
                onBeforeClose: () => this._onBeforeClose()
            });

            // Открываем диалог
            this.modal.open();

        } catch (error) {
            Logger.error("[app][bot-app][permission]:", error);
        }

    }

    // ***************************************************************************
    // Обработчики
    // ***************************************************************************
    _handlers(): void {

        try {

            // Закрыть из шапки
            const headerClose = this.tpl?.querySelector(":scope >.header [action-close]");
            headerClose?.addEventListener("click", () => this.modal?.close());

            // Разрешить: решение фиксируем до закрытия, чтобы не считать его отказом
            const allow = this.tpl?.querySelector(":scope >.footer [action-allow]");
            allow?.addEventListener("click", () => {
                this._decided = true;
                this.modal?.close();
                this.options.callback?.(true);
            });

            // Запретить
            const deny = this.tpl?.querySelector(":scope >.footer [action-deny]");
            deny?.addEventListener("click", () => {
                this._decided = true;
                this.modal?.close();
                this.options.callback?.(false);
            });

        } catch (error) {
            Logger.error("[app][bot-app][permission][handlers]:", error);
        }

    }

    // ***************************************************************************
    // Настройка формы
    // ***************************************************************************
    _setup(): void {

        // Название приложения контролируется ботом — вставляем только через
        // textContent (имя может содержать спецсимволы разметки)
        const desc = this.tpl?.querySelector<HTMLElement>("[data-desc]");
        if (!desc) return;

        const permissionName = window._lc.forms.bot_app.permission[PERMISSION_LOCALE_KEYS[this.options.permission]];
        const text = window._lc.forms.bot_app.permission.desc
            .replace("{app}", () => this.options.app_name)
            .replace("{permission}", () => permissionName);

        desc.textContent = text;

    }

    // ***************************************************************************
    // Действия при закрытии диалога
    // ***************************************************************************
    _onBeforeClose(): void {

        // Удаляем экземпляр формы
        PermissionDialog.instance = null;

        // Закрытие без кнопок (Esc, клик по фону, шапка) — считаем отказом
        if (!this._decided) this.options.callback?.(false);

    }

    // ***************************************************************************
    // Шаблон диалога
    // ***************************************************************************
    _template(): HTMLElement {

        // invariant: корневой .cdm-modal входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`

            <div class="cdm-modal bot-app-permission flex flex-col p-0 gap-0 ${CDM_MODAL_CLASSES()}">
                <div class="${CDM_MODAL_HEADER_CLASSES()}">
                    <span class="flex flex-row gap-2 items-center font-semibold text-base">${window._lc.forms.bot_app.permission.title}</span>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "x" })}
                </div>
                <div class="${CDM_MODAL_CONTENT_CLASSES()}">
                    <span data-desc class="text-secondary text-sm"></span>
                </div>
                <div class="${CDM_MODAL_FOOTER_CLASSES()}">
                    ${Buttons.create({ attributes: ["action-deny"], classes: ["w-full", "h-11"], text: window._lc.forms.bot_app.permission.deny })}
                    ${Buttons.primary({ attributes: ["action-allow"], classes: ["w-full", "h-11"], text: window._lc.forms.bot_app.permission.allow })}
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-modal")!;

    }

}
