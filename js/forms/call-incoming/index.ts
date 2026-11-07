// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";

// Импортируем config
import { CDM_MODAL_CLASSES, CDM_MODAL_CONTENT_CLASSES, CDM_MODAL_FOOTER_CLASSES, CDM_MODAL_HEADER_CLASSES } from "../../config/constants.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Avatars } from "../../components/avatars.js";
import { Buttons } from "../../components/buttons.js";

// Импортируем functions
import { startRingTimer, stopRingTimer } from "./functions/start_ring_timer.js";

// Импортируем handlers
import { acceptCallHandler } from "./handlers/accept.js";
import { declineCallHandler } from "./handlers/decline.js";

// Импортируем типы
import type { CallAvatar } from "../call/types.js";
import { toCallAvatar } from "./types.js";
import type { CallIncomingData } from "./types.js";

/**
 * ***************************************************************************
 * CALL-INCOMING - Форма входящего звонка.
 *
 * Открывается по WS-событию `[call]: incoming` и по deep-link из push-уведомления
 * (`/?callId=…`). Живёт ровно до одного из трёх исходов: приняли, отклонили,
 * истёк таймер ожидания. Звонок при этом на сервере ещё в статусе ringing —
 * комната LiveKit поднимется только после `[call]: accept`.
 * ***************************************************************************
 */
export class CallIncoming {

    // Реестр всех открытых форм CallIncoming: { callId: instance }
    static instances = new Map<string, CallIncoming>();

    /** Настройки формы. */
    options: CallIncomingData["options"];

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Таймер обратного отсчёта ожидания ответа. */
    ringTimer: ReturnType<typeof setInterval> | null = null;

    /** Id звонка. */
    callId: string;

    /** Id звонящего пользователя. */
    userId: string | null;

    /** Имя звонящего. */
    displayName: string | null;

    /** Аватар звонящего (документ картинки либо URL). */
    avatar: CallAvatar;

    /**
     * ***************************************************************************
     * Форма.
     * @param data - Данные.
     * @param data.callId - Id звонка.
     * @param data.userId - Id звонящего пользователя.
     * @param data.displayName - Имя звонящего.
     * @param data.avatar - Аватар (документ {id, token, metadata} или URL).
     * @param data.options - Настройки формы.
     * ***************************************************************************
     */
    constructor(data: CallIncomingData) {

        // Если не передан callId
        if (!data?.callId) throw new Error("Не передан: callId");

        // Устанавливаем настройки
        this.options = {
            ...data?.options
        };

        // Устанавливаем переменные
        this.callId = data.callId;
        this.userId = data.userId || null;
        this.displayName = data.displayName || null;
        this.avatar = toCallAvatar(data.avatar);

        // Получаем instance: один и тот же звонок не должен звать дважды
        const instance = CallIncoming.instances.get(data.callId);
        if (instance) return instance;

        // Регистрируем этот экземпляр формы
        CallIncoming.instances.set(this.callId, this);

        // Инициализация
        this._init();

    }

    // ***************************************************************************
    // Инициализация
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Открывает форму.
     * @returns {Promise<void>}
     * ***************************************************************************
     */
    async _init(): Promise<void> {

        // Открытие
        await this._open();

    }

    // ***************************************************************************
    // Открытие
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Собирает шаблон, оборачивает в Overlay и открывает.
     * @returns {Promise<void>}
     * ***************************************************************************
     */
    async _open(): Promise<void> {

        try {

            // Шаблон формы
            this.tpl = this._template();

            if (!this.tpl) return;

            // Модальное окно
            this.modal = new Overlay(this.tpl, {
                type: "modal",
                url: `?callId=${this.callId}`,
                closeOnEsc: false,
                closeOnOverlay: false,
                onBeforeOpen: () => this._onBeforeOpen(),
                onOpen: () => this._onOpen(),
                onBeforeClose: () => this._onBeforeClose()
            });

            // Открываем форму
            this.modal.open();

        } catch (error) {
            Logger.error("[app][call-incoming]: Ошибка открытия формы", error);
        }

    }

    // ***************************************************************************
    // Логика до открытия формы
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Заполняет имя, аватар и статус.
     * @returns {void}
     * ***************************************************************************
     */
    _onBeforeOpen(): void {
        this._setup();
    }

    // ***************************************************************************
    // Логика после открытия формы
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Запускает таймер ожидания и вешает обработчики кнопок.
     * @returns {void}
     * ***************************************************************************
     */
    _onOpen(): void {

        // Таймер входящего вызова: если пользователь не ответил — отклоняем сами
        startRingTimer(this);

        // Обработчики
        this._handlers();

    }

    // ***************************************************************************
    // Обработчики
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Принять / Отклонить.
     * @returns {void}
     * ***************************************************************************
     */
    _handlers(): void {

        try {

            // Принять
            const accept = this.tpl?.querySelector(`[action-accept]`);
            accept?.addEventListener("click", () => acceptCallHandler(this));

            // Отклонить
            const decline = this.tpl?.querySelector(`[action-decline]`);
            decline?.addEventListener("click", () => declineCallHandler(this));

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Данные формы
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Применяет данные звонящего к шаблону.
     * @returns {void}
     * ***************************************************************************
     */
    _setup(): void {

        try {

            // Устанавливаем элементы
            const avatar = this.tpl?.querySelector<HTMLElement>(":scope >.content .cdm-avatar");
            const name = this.tpl?.querySelector<HTMLElement>(":scope >.content [data-display-name]");
            const subtitle = this.tpl?.querySelector<HTMLElement>(":scope >.content [data-subtitle]");

            // Аватар: компонент Avatars принимает документ картинки;
            // строка-URL (deep-link из push) им не поддерживается —
            // оставляем цветной акроним по имени
            new Avatars({
                element: avatar,
                id: this.userId,
                name: this.displayName,
                image: typeof this.avatar === "object" ? this.avatar : null,
                size: "3xl"
            });

            // Имя
            if (name) name.textContent = this.displayName || window._lc.forms.call.title;

            // Статус
            if (subtitle) subtitle.textContent = window._lc.forms.call_incoming.status.incoming;

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Останавливает таймер и снимает форму с реестра.
     * @returns {void}
     * ***************************************************************************
     */
    _onBeforeClose(): void {

        try {

            // Останавливаем таймер входящего вызова
            stopRingTimer(this);

            // Удаляем экземпляр формы из реестра
            CallIncoming.instances.delete(this.callId);

            // Сообщаем системе, что форма закрыта
            window.dispatchEvent(new CustomEvent("[app][form]::closed", {
                detail: { id: this.modal?.options?.id }
            }));

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Возвращает корневой элемент шаблона формы.
     * @returns {Element}
     * ***************************************************************************
     */
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`

            <div class="cdm-modal call-incoming flex flex-col ${CDM_MODAL_CLASSES()}">
                <div class="${CDM_MODAL_HEADER_CLASSES()}">
                    <span class="font-semibold text-lg">${window._lc.forms.call_incoming.title}</span>
                </div>
                <div class="${CDM_MODAL_CONTENT_CLASSES()} items-center">

                    <div class="flex flex-col gap-3 p-4 bg-[var(--second-bg)] rounded-xl items-center w-full">

                        <div class="cdm-avatar relative"></div>
                        <div class="flex flex-col gap-2 fluid text-center">
                            <span data-display-name class="font-semibold"></span>
                            <span data-subtitle class="text-secondary" role="status" aria-live="polite"></span>
                        </div>

                    </div>

                </div>
                <div class="${CDM_MODAL_FOOTER_CLASSES()}">
                    ${Buttons.danger({ attributes: ["action-decline"], classes: ["w-full"], text: window._lc.forms.call_incoming.decline })}
                    ${Buttons.primary({ attributes: ["action-accept"], classes: ["w-full"], text: window._lc.forms.call_incoming.accept })}
                </div>
            </div>

        `, "text/html").querySelector(".cdm-modal");

    }

}
