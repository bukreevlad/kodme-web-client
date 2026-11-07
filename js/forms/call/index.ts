// Импортируем сторонние пакеты
import { Room, VideoPresets } from "livekit-client";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_CONTENT_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Store } from "../../utils/store.js";
import type { GestureController } from "../../utils/gesture_controller.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { Toast } from "../../components/toast.js";
import type { ToastType } from "../../components/toast.js";

// Импортируем events
import { subscribeStoreEvents } from "./events/store/store_events.js";
import { subscribeLiveKitEvents } from "./events/livekit/livekit_events.js";

// Импортируем handlers
import { startCallHandler } from "./handlers/start_call.js";
import { leaveHandler } from "./handlers/leave.js";
import { addParticipantHandler } from "./handlers/add_participant.js";
import { toggleAudioHandler } from "./handlers/toggle_audio.js";
import { toggleVideoHandler } from "./handlers/toggle_video.js";
import { switchCameraHandler } from "./handlers/switch_camera.js";
import { unlockAudioHandler } from "./handlers/unlock_audio.js";
import { backToGridHandler } from "./handlers/focus_grid.js";
import { switchStageHandler } from "./handlers/switch_stage.js";
import { initImmersiveToggle } from "./handlers/toggle_immersive.js";

// Импортируем functions
import { connect } from "./functions/connect.js";
import { setState } from "./functions/set_state.js";
import { renderAvatar } from "./functions/render_avatar.js";
import { stopTimer } from "./functions/start_timer.js";
// Именованный импорт: stopNoAnswerTimer — не startNoAnswerTimer этого модуля
import { stopNoAnswerTimer } from "./functions/no_answer_timer.js";
import { updateBarsHeight } from "./functions/update_bars_height.js";
import { placeSelfTile, initSelfDrag, destroySelfDrag } from "./functions/self_view.js";

// Импортируем requests
import { leaveRequest } from "./requests/leave.js";

// Импортируем типы
import type { CallAvatar, CallCloseReason, CallParticipantData, CallQualityLevel, CallState, CallTileFraction, CallViewMode } from "./types.js";
import { I18n, t } from "../../utils/i18n/index.js";

/**
 * Данные формы звонка (constructor).
 */
export interface CallData {

    /** Id звонка (известен принявшей стороне и после ответа "[call]: start"). */
    callId?: string | null;

    /** Id собеседника (нужен инициатору до старта звонка). */
    userId?: string | null | undefined;

    /** Имя собеседника. */
    displayName?: string | null | undefined;

    /** Аватар собеседника. */
    avatar?: CallAvatar | undefined;

    /** Токен LiveKit (принимающая сторона). */
    token?: string | null;

    /** Начинает ли этот клиент звонок. */
    isInitiator?: boolean;

    /** Настройки формы. */
    options?: CallOptions;

}

/**
 * Настройки формы звонка.
 */
export interface CallOptions {

    /** Куда вставить форму (по умолчанию — контейнер домашней формы). */
    insertInto?: HTMLElement | null;

    /** Прочие ключи пресета оверлея (прокидываются как есть). */
    [key: string]: unknown;

}

/**
 * Данные обновления формы (update).
 */
export interface CallUpdateData {

    /** Имя собеседника. */
    displayName?: string | null;

    /** Аватар собеседника. */
    avatar?: CallAvatar;

}

/**
 * Опции завершения звонка (endCall).
 */
export interface CallEndOptions {

    /** Причина закрытия формы. */
    reason?: CallCloseReason;

    /** Текст тоста (показывается, если задан). */
    toast?: string;

    /** Тип тоста. */
    toastType?: ToastType;

}

/**
 * ***************************************************************************
 * CALL - Форма звонка (1-1 и группового) на базе LiveKit.
 *
 * Транспорт медиа — тот же LiveKit, что у встреч: комната `call::<call_id>`
 * поднимается лениво при первом подключении. От встреч форма отличается
 * раскладкой и отсутствием модерации:
 *   - 1-1: собеседник на весь экран, плашка «я» движимая и видна всегда;
 *   - 3+: автоматически сетка, клик по плитке переводит её во весь экран;
 *   - кнопки: микрофон, камера, смена камеры, приглашение, выход.
 * Трансляции экрана нет — запрет стоит в грантах токена на сервере.
 * ***************************************************************************
 */
export class Call {

    // Реестр всех открытых форм Call: { callId | userId: instance }
    static instances = new Map<string, Call>();

    /** Настройки формы. */
    options: CallOptions;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Контент формы (для жестов). */
    content: HTMLElement | null = null;

    /** Список участников (раскладка). */
    list: HTMLElement | null = null;

    /** Плашка «я» (движимая мини-плитка). */
    selfTile: HTMLElement | null = null;

    /** Шапка формы. */
    header: HTMLElement | null = null;

    /** Футер формы. */
    footer: HTMLElement | null = null;

    /** Комната LiveKit (создаётся в _init). */
    // invariant: _init вызывается из конструктора и создаёт комнату
    // синхронно (до первого await) — к первому чтению поле заполнено
    room!: Room;

    /** Хранилище участников (включая локального). */
    store: Store<CallParticipantData> = new Store<CallParticipantData>();

    // Ключ реестра: до старта звонок известен по собеседнику, после —
    // по id звонка (по нему же приходят [call]: declined)
    /** Ключ реестра экземпляров. */
    key: string;

    /** Id звонка. */
    callId: string | null;

    /** Id собеседника. */
    userId: string | null;

    /** Имя собеседника. */
    displayName: string | null;

    /** Аватар собеседника. */
    avatar: CallAvatar;

    /** Начинает ли этот клиент звонок. */
    isInitiator: boolean;

    /** Влит ли в уже активный звонок собеседника (is_merged). */
    isMerged = false;

    /** Токен LiveKit: инициатор получает его по "[call]: start", принимающая сторона — по "[call]: accept". */
    token: string | null;

    /** Состояние звонка (starting → ringing → active). */
    callState: CallState = "starting";

    /** Флаг закрытия: без него Disconnected показал бы тост об ошибке при выходе по кнопке. */
    isClosing = false;

    /** Причина закрытия формы. */
    closeReason: CallCloseReason | null = null;

    /** Таймер длительности звонка. */
    durationTimer: ReturnType<typeof setInterval> | null = null;

    /** Таймер ожидания ответа. */
    noAnswerTimer: ReturnType<typeof setInterval> | null = null;

    /** Уровень качества связи: null — индикатор скрыт. */
    qualityLevel: CallQualityLevel | null = null;

    /** Функция отписки от глобального слушателя разблокировки аудио. */
    unlockAudioCleanup: (() => void) | null = null;

    /** Режим раскладки: "spotlight" | "grid" | "focus" (считается в functions/apply_view_mode.ts). */
    viewMode: CallViewMode | null = null;

    // Identity участника, чье видео занимает сцену (роль .call-stage).
    // null — сцены нет, раскладка сетка. Одно поле держит и обмен
    // местами в личном звонке, и фокус в группе: в паре на сцене
    // по умолчанию собеседник, своё видео попадает туда по клику
    /** Identity участника на сцене. */
    stageIdentity: string | null = null;

    /** Иммерсивный режим: шапка и футер убраны, тап по видео возвращает. */
    isImmersive = false;

    /** Функция отписки тапа по видео (иммерсивный режим). */
    immersiveCleanup: (() => void) | null = null;

    // Позиция мини-плитки в долях рабочей области и контроллер жеста.
    // Одновременно на экране только одна мини-плитка, поэтому позиция
    // и жест общие для плашки «я» и мини-плитки собеседника
    /** Позиция мини-плитки в долях. */
    tileFraction: CallTileFraction | null = null;

    /** Контроллер жеста мини-плитки. */
    tileDrag: GestureController | null = null;

    /** Элемент, который сейчас мини (плашка «я» либо собеседник). */
    miniDragTile: HTMLElement | null = null;

    /** Обработчик пересчёта позиции при ресайзе/повороте экрана. */
    onViewportChanged: (() => void) | null = null;

    // Флаг «плашку только что перетаскивали»: после drag браузер всё
    // равно шлёт click, и он не должен сработать как выбор плитки
    /** Флаг недавнего перетаскивания плашки «я». */
    selfViewDragMoved = false;

    /** Таймер сброса флага selfViewDragMoved. */
    selfViewDragMovedTimer: ReturnType<typeof setTimeout> | null = null;

    /** Таймер анимации «устаивания» раскладки (functions/apply_view_mode.ts). */
    settleTimer: ReturnType<typeof setTimeout> | null = null;

    /** Пресет камеры (facingMode), выбранный переключением камеры. */
    videoSettings: { facingMode?: "user" | "environment" } | null = null;

    /**
     * ***************************************************************************
     * Форма.
     * @param data - Данные.
     * ***************************************************************************
     */
    constructor(data: CallData) {

        // Если не переданы ни звонок, ни собеседник
        if (!data?.callId && !data?.userId) throw new Error("Не переданы: callId или userId");

        // Получаем instance: до старта звонок известен по собеседнику,
        // после — по id звонка (по нему же приходят [call]: declined)
        const key = data.callId ?? data.userId ?? "";

        // Устанавливаем настройки
        this.options = {
            insertInto: document.querySelector<HTMLElement>(".cdm-form.home .middle >.form-container"),
            ...data?.options
        };

        this.key = key;
        this.callId = data.callId || null;
        this.userId = data.userId || null;
        this.displayName = data.displayName || null;
        this.avatar = data.avatar || null;
        this.isInitiator = Boolean(data.isInitiator);
        this.token = data.token || null;

        // Регистрируем этот экземпляр формы
        const instance = Call.instances.get(key);
        if (instance) return instance;

        Call.instances.set(this.key, this);

        // Инициализация
        this._init();

    }

    // ***************************************************************************
    // Инициализация
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Создаёт комнату LiveKit, подписывается на события и открывает форму.
     * @returns Промис открытия.
     * ***************************************************************************
     */
    async _init(): Promise<void> {

        // Создаем объект комнаты LiveKit
        this.room = new Room({
            adaptiveStream: true,
            dynacast: true,
            videoCaptureDefaults: {
                resolution: VideoPresets.h720.resolution,
            }
        });

        // Подписываемся на события Store
        subscribeStoreEvents(this);

        // Подписываемся на события LiveKit
        subscribeLiveKitEvents(this);

        // Открытие
        await this._open();

    }

    // ***************************************************************************
    // Открытие
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Собирает шаблон, оборачивает его в Overlay и открывает.
     * @returns Промис открытия.
     * ***************************************************************************
     */
    async _open(): Promise<void> {

        try {

            // Шаблон формы
            this.tpl = this._template();

            if (!this.tpl) return;

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "form",
                url: `?call=${this.callId || this.userId}`,
                insertInto: this.options.insertInto,
                closeOnEsc: false,
                closeOnOverlay: false,
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: async () => await this._onOpen(),
                onBeforeClose: () => this._onBeforeClose(),
                // Легаси передавал "" — рантайм-эквивалентно null:
                // пресет формы без явного AnimationPreset не анимирует слой
                openAnimationClass: null,
                closeAnimationClass: null
            });

            // Открываем форму
            this.modal.open();

        } catch (error) {
            Logger.error("[app][call]: Ошибка открытия формы звонка", error);
        }

    }

    // ***************************************************************************
    // Обработчики
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Вешает обработчики кнопок шапки, оверлея и футера.
     * @returns {void}
     * ***************************************************************************
     */
    _handlers(): void {

        try {

            // Отмена вызова в оверлее (до принятия звонка)
            this.tpl?.querySelector(":scope >.content [action-cancel]")
                ?.addEventListener("click", () => leaveHandler(this));

            // ---------- ФУТЕР ----------
            // Переключить микрофон
            this.tpl?.querySelector("[action-toggle-audio]")
                ?.addEventListener("click", (event) => toggleAudioHandler(event, this));

            // Переключить камеру
            this.tpl?.querySelector("[action-toggle-video]")
                ?.addEventListener("click", (event) => toggleVideoHandler(event, this));

            // Переключить фронтальную/заднюю камеру
            this.tpl?.querySelector("[action-switch-camera]")
                ?.addEventListener("click", (event) => switchCameraHandler(event, this));

            // Пригласить ещё одного участника
            this.tpl?.querySelector("[action-add-participant]")
                ?.addEventListener("click", () => addParticipantHandler(this));

            // Завершить звонок
            this.tpl?.querySelector("[action-leave]")
                ?.addEventListener("click", () => leaveHandler(this));

            // Возврат в сетку: кнопка видна только в режиме фокуса
            this.tpl?.querySelector("[action-back-to-grid]")
                ?.addEventListener("click", () => backToGridHandler(this));

            // Своя плашка: в личном звонке клик по ней меняет видео
            // местами. Тот же обработчик, что и у чужих плиток
            this.tpl?.querySelector(":scope >.content [data-self-tile]")
                ?.addEventListener("click", () => {

                    // Клик после перетаскивания — жест был про позицию.
                    // Флаг «съедается»: если клик всё же пришёл раньше
                    // таймера сброса, следующий настоящий клик не должен
                    // пострадать
                    if (this.selfViewDragMoved) {
                        this.selfViewDragMoved = false;
                        return;
                    }

                    switchStageHandler(this, this.room?.localParticipant?.identity, this.selfTile);

                });
            // ---------- ФУТЕР ----------

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Логика до открытия формы
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Готовит элементы формы и регистрирует звонок на сервере (только для
     * инициатора). Возврат `false` отменяет открытие: без звонка на сервере
     * и без токена оставаться в форме бессмысленно.
     * @returns false — отмена открытия, иначе undefined.
     * ***************************************************************************
     */
    async _onBeforeOpen(): Promise<boolean | void> {

        try {

            // ---------- ЭЛЕМЕНТЫ ----------
            this.content = this.tpl?.querySelector(":scope >.content") ?? null;
            this.list = this.tpl?.querySelector(":scope >.content [data-list]") ?? null;
            this.selfTile = this.tpl?.querySelector(":scope >.content [data-self-tile]") ?? null;
            this.header = this.tpl?.querySelector(":scope >[data-header]") ?? null;
            this.footer = this.tpl?.querySelector(":scope >[data-footer]") ?? null;
            // ---------- ЭЛЕМЕНТЫ ----------

            // Имя и аватар собеседника в шапке и оверлее
            this._update();

            // Пока звонок не зарегистрирован, показываем «Соединение…»
            setState(this, "starting");

            // ---------- СТАРТ ЗВОНКА ----------
            // Принимающая сторона получает токен из "[call]: accept"
            // и звонок на сервере регистрировать не должна
            if (this.isInitiator) {

                // Возвращает false, если сервер отклонил запрос
                const isStarted = await startCallHandler(this);
                if (!isStarted) {
                    this.closeReason = "start_error";
                    return false;
                }

            }
            // ---------- СТАРТ ЗВОНКА ----------

        } catch (error) {

            Logger.error("[app][call]: Ошибка при подготовке звонка", error);

            // Toast
            Toast.error(t("forms.call.toasts.start_error"), {
                position: "top-center"
            });

            this.closeReason = "start_error";
            return false;

        }

    }

    // ***************************************************************************
    // Логика после открытия формы
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Включает обработчики, готовит плашку «я» и подключается к комнате.
     * @returns Промис подключения.
     * ***************************************************************************
     */
    async _onOpen(): Promise<void> {

        // ---------- СИСТЕМА ----------
        window.dispatchEvent(new CustomEvent("[app][form]::opened", {
            detail: {
                id: this.modal?.options.id,
                data: {
                    instance: this,
                    title: this.displayName || t("forms.call.title")
                }
            }
        }));
        // ---------- СИСТЕМА ----------

        // Включаем обработчики
        this._handlers();

        // Разблокировка аудио: браузеры не дают запустить аудиоконтекст
        // без жеста пользователя
        this.unlockAudioCleanup = unlockAudioHandler(this);

        // Плашка «я»: позиция по умолчанию и перетаскивание
        updateBarsHeight(this);
        placeSelfTile(this);
        initSelfDrag(this);

        // Тап по видео прячет и возвращает панели (иммерсивный режим)
        this.immersiveCleanup = initImmersiveToggle(this);

        // Пересчёт позиции при ресайзе и повороте экрана: сначала высота
        // панелей (от неё считается базовое положение), потом позиция
        this.onViewportChanged = () => {
            updateBarsHeight(this);
            placeSelfTile(this);
        };
        window.addEventListener("resize", this.onViewportChanged);
        window.addEventListener("orientationchange", this.onViewportChanged);

        // Без токена комната недоступна: показываем ошибку и закрываемся
        if (!this.token) {

            Logger.warn("[app][call]: Не получен токен LiveKit, подключение не выполняется");

            // Toast
            Toast.error(t("forms.call.toasts.connection_failed"), {
                position: "top-center"
            });

            this.closeReason = "connect_error";
            this.modal?.close();
            return;

        }

        // Подключаемся к серверу
        await connect(this);

    }

    // ***************************************************************************
    // Публичный метод: Обновление данных формы
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Применяет данные звонка к шапке и оверлею.
     * @param data - Данные.
     * @returns {void}
     * ***************************************************************************
     */
    update(data?: CallUpdateData): void {

        try {

            if (!data) return;

            // Имя
            if (data.displayName !== undefined) this.displayName = data.displayName;

            // Аватар
            if (data.avatar !== undefined) this.avatar = data.avatar;

            // Применяем к шаблону
            this._update();

        } catch (error) {
            Logger.error("[app][call]: Ошибка при обновлении данных формы", error);
        }

    }

    // ***************************************************************************
    // Приватный метод: Применение данных к шаблону
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Пишет имя собеседника в шапку и оверлей и рисует его аватар.
     * @returns {void}
     * ***************************************************************************
     */
    _update(): void {

        // Локализация
        const locale = I18n.tree.forms.call;
        const name = this.displayName || locale.title;

        // Имя собеседника в шапке (его же перезаписывает счётчик
        // участников, когда звонок становится групповым)
        const headerName = this.tpl?.querySelector<HTMLElement>(":scope >[data-header] [data-name]");
        if (headerName) headerName.textContent = name;

        // Имя и аватар в оверлее вызова
        const overlayName = this.tpl?.querySelector<HTMLElement>(":scope >.content [data-overlay-name]");
        if (overlayName) overlayName.textContent = name;

        // Аватар собеседника
        renderAvatar(this, ":scope >.content [data-overlay-avatar]", "3xl");

    }

    // ***************************************************************************
    // Публичный метод: Завершение звонка
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Закрывает форму с нужной причиной и, при необходимости, показывает тост.
     * @param options - Опции закрытия.
     * @returns {void}
     * ***************************************************************************
     */
    endCall(options: CallEndOptions = {}): void {

        try {

            // Запоминаем причину: от неё зависит, нужно ли слать
            // "[call]: leave" при закрытии
            this.closeReason = options.reason || "hangup";

            // Показываем тост (если задан)
            if (options.toast) {
                Toast.custom(options.toast, {
                    type: options.toastType || "default",
                    position: "top-center"
                });
            }

            this.modal?.close();

        } catch (error) {
            Logger.error("[app][call]: Ошибка при завершении звонка", error);
        }

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Отписывается от комнаты, чистит таймеры и подписки, извещает сервер
     * о выходе и снимает форму с реестра.
     * @returns {void}
     * ***************************************************************************
     */
    _onBeforeClose(): void {

        try {

            // ---------- CLEANUP ----------
            // Флаг нужен обработчику Disconnected: без него выход по кнопке
            // «Завершить» показал бы тост об ошибке соединения
            this.isClosing = true;

            // Снимаем глобальный слушатель разблокировки аудио
            this.unlockAudioCleanup?.();
            this.unlockAudioCleanup = null;

            // Тап по видео для иммерсивного режима
            this.immersiveCleanup?.();
            this.immersiveCleanup = null;

            // Таймеры
            stopNoAnswerTimer(this);
            stopTimer(this);

            // Плашка «я»
            destroySelfDrag(this);
            if (this.selfViewDragMovedTimer !== null) clearTimeout(this.selfViewDragMovedTimer);

            // Пересчёт позиции при ресайзе
            if (this.onViewportChanged) {
                window.removeEventListener("resize", this.onViewportChanged);
                window.removeEventListener("orientationchange", this.onViewportChanged);
                this.onViewportChanged = null;
            }

            // Отключаемся от комнаты при закрытии формы
            if (this.room) this.room.disconnect();

            // Убираем карточки участников и их подписки на обновления
            this.store?.removeAll();
            // ---------- CLEANUP ----------

            // ---------- ИЗВЕЩЕНИЕ СЕРВЕРА ----------
            // Звонок мог закрыться и без нас (собеседник отклонил, комната
            // умерла) — тогда запрос ничего не сделает, он идемпотентен.
            // Отказываемся от него только там, где звонка на сервере нет:
            // старт не состоялся (start_error) или форма входящего звонка
            // (cancelled)
            if (this.callId && this.closeReason !== "start_error" && this.closeReason !== "cancelled") {
                leaveRequest({ call_id: this.callId }).catch((error) => {
                    Logger.debug("[app][call]: Не удалось отправить выход из звонка", error);
                });
            }
            // ---------- ИЗВЕЩЕНИЕ СЕРВЕРА ----------

            // Удаляем экземпляр формы из реестра
            Call.instances.delete(this.key);

            // Сообщаем системе, что форма закрыта
            window.dispatchEvent(new CustomEvent("[app][form]::closed", {
                detail: { id: this.modal?.options?.id }
            }));

        } catch (error) {
            Logger.error("[app][call]: Ошибка при закрытии формы звонка", error);
        }

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Возвращает корневой элемент шаблона формы.
     * @returns Корневой элемент шаблона.
     * ***************************************************************************
     */
    _template(): HTMLElement | null {

        // Локализация
        const locale = I18n.tree.forms.call;
        const footer = locale.footer;

        return new DOMParser().parseFromString(`

            <div class="cdm-form call flex flex-col gap-0 w-full h-full ${CDM_FORM_CLASSES()}">

                <!-- Шапка: имя собеседника, счётчик участников, таймер
                     и индикатор качества. Абсолютная и прозрачная,
                     плавает поверх видео: фоновой плашки и границы у неё
                     нет, нижнюю границу заменяет градиентная «фата» из
                     css/forms/call.css (тёмная в обеих темах) -->
                <div data-header class="header absolute w-full z-30 top-0 left-0 min-h-[var(--form-header-min-height)] flex flex-row gap-2 p-2 items-center justify-between">
                    <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                        <span data-name class="font-semibold text-[0.95rem] leading-tight truncate"></span>
                        <!-- min-h и фиксированная ширина таймера: без них
                             появление отсчёта меняет высоту шапки и она
                             прыгает поверх видео -->
                        <div class="flex flex-row items-center gap-2 min-h-[1rem] text-xs text-secondary leading-tight">
                            <span data-participants-count class="hidden"></span>
                            <span data-timer class="min-w-[2.5rem] tabular-nums"></span>
                        </div>
                    </div>
                    <!-- Кнопка «вернуться в сетку»: видна только в режиме
                         фокуса (3+ участника, один во весь экран) -->
                    <div data-back-to-grid class="hidden flex flex-row gap-2 items-center">
                        ${Buttons.circle({ attributes: ["action-back-to-grid", "title=" + footer.back_to_grid, "aria-label=" + footer.back_to_grid], icon: "layout-grid" })}
                    </div>
                    <!-- Индикатор качества связи: только иконка, цвет
                         по уровню задаёт functions/apply_connection_quality -->
                    <div data-connection-quality class="hidden flex flex-row items-center" role="status" aria-live="polite">
                        <span data-quality-icon class="flex items-center"></span>
                    </div>
                </div>

                <!-- Контент: раскладка участников, плашка «я» и оверлей
                     вызова. Раскладка (spotlight / grid) задаётся классом
                     call-layout-* из functions/apply_view_mode.ts -->
                <div data-content class="content relative flex-1 w-full min-h-0 overflow-hidden ${CDM_FORM_CONTENT_CLASSES()}">

                    <!-- Список участников. Плашка «я» лежит ВНУТРИ
                         списка: в сетке (3+ участников) она занимает
                         равную ячейку, а в режимах со сценой роль
                         call-corner / call-stage делает её абсолютной —
                         как раньше вне списка. role=presentation убирает
                         плашку из дерева доступности, оставляя список
                         без лишнего уровня -->
                    <div data-list class="call-participants call-layout-spotlight" role="list" aria-label="${locale.participants_list}">
                        <div data-self-tile class="call-self-tile call-corner hidden" role="presentation"></div>
                    </div>

                    <!-- Оверлей вызова: соединение, прозвон и финал.
                         Живой текст, а не картинка: скринридер читает его -->
                    <div data-call-overlay class="call-overlay absolute inset-0 z-20 hidden flex flex-col gap-4 items-center justify-center px-6 text-center">
                        <div class="call-ring relative flex flex-shrink-0 items-center justify-center">
                            <div data-overlay-avatar class="cdm-avatar relative"></div>
                            <span class="ring"></span>
                            <span class="ring"></span>
                        </div>
                        <div class="flex flex-col gap-1 items-center">
                            <span data-overlay-name class="font-semibold text-lg leading-tight truncate max-w-full"></span>
                            <span data-overlay-status class="text-sm text-secondary leading-tight" role="status" aria-live="polite"></span>
                            <span data-overlay-timer class="text-xs text-secondary tabular-nums"></span>
                        </div>
                        <div data-overlay-actions class="flex flex-row gap-2 items-center">
                            ${Buttons.transparent({ attributes: ["action-cancel"], text: locale.cancel })}
                        </div>
                    </div>

                </div>

                <!-- Футер: кнопки управления. Абсолютный и плавает над
                     видео (в spotlight и focus), в сетке раскладка оставляет
                     под ним место. Подложка .wrap и нижний отступ описаны
                     в css/forms/call.css — там же разобраны две ловушки
                     этого места: подмена padding штатным [data-safe-area-bottom]
                     и задвоение inset от капабилити safe_area -->
                <div data-footer class="footer absolute w-full z-30 bottom-0 left-0 flex flex-row justify-center p-3">
                    <div class="wrap flex flex-row items-center gap-2 p-2 rounded-full">
                        ${Buttons.circle({ intent: "standard", attributes: ["action-toggle-audio", "title=" + footer.toggle_audio, "aria-label=" + footer.toggle_audio], icon: "microphone-off" })}
                        ${Buttons.circle({ intent: "standard", attributes: ["action-toggle-video", "title=" + footer.toggle_video, "aria-label=" + footer.toggle_video], icon: "video-off" })}
                        ${Buttons.circle({ intent: "standard", attributes: ["action-switch-camera", "title=" + footer.switch_camera, "aria-label=" + footer.switch_camera], icon: "camera-rotate" })}
                        ${Buttons.circle({ intent: "standard", attributes: ["action-add-participant", "title=" + footer.add_participant, "aria-label=" + footer.add_participant], icon: "user-plus" })}
                        ${Buttons.circle({ intent: "danger", attributes: ["action-leave", "title=" + footer.leave, "aria-label=" + footer.leave], icon: "phone-off" })}
                    </div>
                </div>

            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

    }

}
