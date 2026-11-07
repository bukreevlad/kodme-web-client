// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_CONTENT_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { Avatars } from "../../components/avatars.js";

// Импортируем менеджеры
import { SecretCallsManager } from "../../core/managers/secret_calls_manager.js";

// Импортируем functions
import { getUserInfoRequest } from "../user-profile/requests/get_user_info.js";
import { stopTimer } from "./functions/start_timer.js";
import { destroySelfDrag, initSelfDrag } from "./functions/self_view.js";
import { renderCallState } from "./functions/render_state.js";

// Импортируем events
import { subscribeManagerEvents } from "./events/manager_events.js";

// Импортируем handlers
import { toggleAudioHandler } from "./handlers/toggle_audio.js";
import { toggleVideoHandler } from "./handlers/toggle_video.js";
import { switchCameraHandler } from "./handlers/switch_camera.js";
import { hangupHandler } from "./handlers/hangup.js";

// Импортируем типы
import type { GestureController } from "../../utils/gesture_controller.js";
import type { SecretCallState } from "../../core/managers/secret_calls_manager.js";

/**
 * Настройки формы секретного звонка.
 */
export interface SecretCallOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null | undefined;

}

/**
 * Данные конструктора формы секретного звонка.
 */
export interface SecretCallData {

    /** Id звонка (UUIDv7, живёт в сигналинге как call_id). */
    callId: string;

    /** Настройки формы. */
    options?: SecretCallOptions;

}

/**
 * ***************************************************************************
 * SECRET_CALL - форма секретного звонка (WebRTC P2P, 1 на 1).
 *
 * Видео собеседника — на весь экран, своё видео — в подвижной угловой
 * плашке (клик по плашке меняет видео местами). Управление: микрофон,
 * камера, смена камеры, завершение. Медиа шифруется DTLS-SRTP (стандарт
 * WebRTC). Живёт поверх чего угодно: звонок приходит без открытых форм.
 * ***************************************************************************
 */
export class SecretCall {

    // Переменная для хранения единственного экземпляра формы
    static instance: SecretCall | null = null;

    /**
     * ***************************************************************************
     * Форма секретного звонка.
     * @param data - Данные: id звонка.
     * ***************************************************************************
     */
    constructor(data: SecretCallData) {

        // Устанавливаем настройки
        this.options = {
            insertInto: document.querySelector<HTMLElement>(".cdm-form.home .middle .form-container"),
            ...data?.options
        };

        // Id звонка (медиа и состояние держит менеджер)
        this.callId = data.callId;

        // Переменные формы
        this.tpl = null;
        this.modal = null;

        // Проверяем, существует ли уже экземпляр
        if (SecretCall.instance) {
            SecretCall.instance.modal?.activate();
            return SecretCall.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        SecretCall.instance = this;

        // Инициализация
        this._init();

    }

    // Настройки формы
    options: SecretCallOptions;

    // Id звонка
    callId: string;

    // Каркас: шаблон и модалка
    tpl: HTMLElement | null;
    modal: Overlay | null;

    /** Отписки от событий менеджера. */
    unsubscribes: (() => void)[] = [];

    /** Таймер длительности звонка. */
    durationTimer: ReturnType<typeof setInterval> | null = null;

    /** Таймер авто-закрытия после завершения звонка. */
    endCloseTimer: ReturnType<typeof setTimeout> | null = null;

    // Жест перетаскивания угловой плашки
    tileDrag: GestureController | null = null;

    /** Плашка двигалась (клик после драга не считается обменом). */
    tileDragMoved = false;

    /** Таймер сброса флага перетаскивания. */
    tileDragMovedTimer: ReturnType<typeof setTimeout> | null = null;

    /** Позиция угловой плашки в долях рабочей области (переживает повороты). */
    tileFraction: { x: number; y: number } | null = null;

    /** Видео «я» сейчас в угловой плашке (иначе — на сцене, после обмена). */
    selfInCorner = true;

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
                type: "form",
                insertInto: this.options.insertInto,
                closeOnEsc: false,
                closeOnOverlay: false,
                closeOnSwipe: null,
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: async () => await this._onOpen(),
                onBeforeClose: () => this._onBeforeClose()
            });

            // Открываем форму
            this.modal.open();

        } catch (error) {
            Logger.error("[app][secret-call]: ошибка открытия формы:", error);
        }

    }

    // ***************************************************************************
    // Настройка формы: медиапотоки, профиль собеседника, подписки
    // ***************************************************************************
    async _onBeforeOpen(): Promise<void> {

        try {

            // Элементы и жесты заполняются из шаблона — без него нечего настраивать
            if (!this.tpl) return;

            // Медиапотоки: события могли прийти раньше открытия формы
            const manager = SecretCallsManager.instance;
            const snapshot = manager?.getSnapshot(this.callId) ?? null;

            const selfVideo = this.tpl.querySelector<HTMLVideoElement>(":scope [data-self-video]");
            const peerVideo = this.tpl.querySelector<HTMLVideoElement>(":scope [data-peer-video]");
            if (selfVideo && snapshot?.localStream) selfVideo.srcObject = snapshot.localStream;
            if (peerVideo && snapshot?.remoteStream) peerVideo.srcObject = snapshot.remoteStream;

            // Профиль собеседника: имя и аватар в шапке и на оверлее
            if (snapshot) this._loadPeer(snapshot.peerUserId);

            // Подписки на события менеджера (состояние, потоки, завершение)
            this.unsubscribes.push(subscribeManagerEvents(this));

            // Текущее состояние звонка
            renderCallState(this, snapshot?.state ?? "calling");

            // Подвижная угловая плашка и обмен видео местами по клику
            initSelfDrag(this);

        } catch (error) {
            Logger.error("[app][secret-call]: ошибка настройки формы:", error);
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
    // Обработчики кнопок формы
    // ***************************************************************************
    _handlers(): void {

        try {

            // Обработчики вешаются на узлы шаблона — без него нечего слушать
            if (!this.tpl) return;

            this.tpl.querySelector(":scope [action-toggle-audio]")
                ?.addEventListener("click", () => toggleAudioHandler(this));
            this.tpl.querySelector(":scope [action-toggle-video]")
                ?.addEventListener("click", () => toggleVideoHandler(this));
            this.tpl.querySelector(":scope [action-switch-camera]")
                ?.addEventListener("click", () => switchCameraHandler(this));
            this.tpl.querySelector(":scope [action-hangup]")
                ?.addEventListener("click", () => hangupHandler(this));
            this.tpl.querySelector(":scope [action-cancel]")
                ?.addEventListener("click", () => hangupHandler(this));

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // ПУБЛИЧНЫЙ МЕТОД: Обновление состояния формы (вызывает events/manager_events)
    // @param state - Новое состояние звонка.
    // ***************************************************************************
    update(state: SecretCallState): void {

        renderCallState(this, state);

    }

    // ***************************************************************************
    // Действия при закрытии формы: очистка ресурсов и подписок
    // ***************************************************************************
    _onBeforeClose(): void {

        // Гасим таймеры
        stopTimer(this);
        if (this.endCloseTimer) {
            clearTimeout(this.endCloseTimer);
            this.endCloseTimer = null;
        }
        if (this.tileDragMovedTimer) {
            clearTimeout(this.tileDragMovedTimer);
            this.tileDragMovedTimer = null;
        }

        // Снимаем жест плашки и подписки на события менеджера
        destroySelfDrag(this);
        for (const unsubscribe of this.unsubscribes) unsubscribe();
        this.unsubscribes = [];

        // Удаляем экземпляр формы
        SecretCall.instance = null;

    }

    // ***************************************************************************
    // Профиль собеседника: имя и аватар в шапке и на оверлее звонка
    // ***************************************************************************
    async _loadPeer(peerUserId: string): Promise<void> {

        try {

            const response = await getUserInfoRequest({ user_id: peerUserId });
            if (!response.status || !response.data || !this.tpl) return;

            const name = response.data.display_name;
            for (const element of this.tpl.querySelectorAll<HTMLElement>(":scope [data-peer-name]")) {
                element.textContent = name;
            }

            const avatarSlots = this.tpl.querySelectorAll<HTMLElement>(":scope .cdm-avatar");
            for (const slot of avatarSlots) {
                new Avatars({
                    element: slot,
                    id: peerUserId,
                    name: name,
                    image: response.data.avatar ?? null,
                    size: "xl",
                    wrapClasses: ["rounded-full"]
                });
            }

        } catch (error) {
            Logger.debug("[app][secret-call]: профиль собеседника недоступен.", error);
        }

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        // Локализация
        const locale = window._lc.forms.secret_call;
        const footer = locale.footer;

        return new DOMParser().parseFromString(`

            <div class="cdm-form secret-call flex flex-col gap-0 w-full h-full ${CDM_FORM_CLASSES()}">

                <!-- Шапка: имя собеседника, статус и таймер — поверх видео -->
                <div data-header class="header absolute w-full z-30 top-0 left-0 min-h-[var(--form-header-min-height)] flex flex-row gap-2 p-2 items-center justify-between">
                    <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                        <span data-peer-name class="font-semibold text-[0.95rem] leading-tight truncate"></span>
                        <div class="flex flex-row items-center gap-2 min-h-[1rem] text-xs text-secondary leading-tight">
                            <span data-status></span>
                            <span data-timer class="min-w-[2.5rem] tabular-nums"></span>
                        </div>
                    </div>
                </div>

                <!-- Контент: сцена собеседника, угловая плашка «я» и оверлей
                     вызова (прозвон/соединение/финал) -->
                <div data-content class="content relative flex-1 w-full min-h-0 overflow-hidden ${CDM_FORM_CONTENT_CLASSES()}">
                    <div data-peer-tile class="secret-call-stage">
                        <video data-peer-video autoplay playsinline></video>
                    </div>
                    <div data-self-tile class="secret-call-corner">
                        <video data-self-video autoplay playsinline muted></video>
                    </div>

                    <div data-call-overlay class="absolute inset-0 z-20 hidden flex flex-col gap-4 items-center justify-center px-6 text-center">
                        <div class="relative flex flex-shrink-0 items-center justify-center">
                            <div class="cdm-avatar relative"></div>
                        </div>
                        <div class="flex flex-col gap-1 items-center">
                            <span data-peer-name class="font-semibold text-lg leading-tight truncate max-w-full"></span>
                            <span data-overlay-status class="text-sm text-secondary leading-tight"></span>
                        </div>
                        <div class="flex flex-row gap-2 items-center">
                            ${Buttons.transparent({ attributes: ["action-cancel"], text: footer.cancel })}
                        </div>
                    </div>
                </div>

                <!-- Футер: управление звонком поверх видео -->
                <div data-footer class="footer absolute w-full z-30 bottom-0 left-0 flex flex-row justify-center p-3">
                    <div class="wrap flex flex-row items-center gap-2 p-2 rounded-full">
                        ${Buttons.circle({ intent: "standard", attributes: ["action-toggle-audio", "title=" + footer.toggle_audio, "aria-label=" + footer.toggle_audio], icon: "microphone" })}
                        ${Buttons.circle({ intent: "standard", attributes: ["action-toggle-video", "title=" + footer.toggle_video, "aria-label=" + footer.toggle_video], icon: "video" })}
                        ${Buttons.circle({ intent: "standard", attributes: ["action-switch-camera", "title=" + footer.switch_camera, "aria-label=" + footer.switch_camera], icon: "camera-rotate" })}
                        ${Buttons.circle({ intent: "danger", attributes: ["action-hangup", "title=" + footer.hangup, "aria-label=" + footer.hangup], icon: "phone-off" })}
                    </div>
                </div>

            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

    }

}
