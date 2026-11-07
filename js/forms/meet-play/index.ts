// Импортируем сторонние пакеты
import { Room, VideoPresets, ScreenSharePresets } from "livekit-client";
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Store } from "../../utils/store.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { Toast } from "../../components/toast.js";

// Импортируем forms
import { Messages } from "../messages/index.js";

// Импортируем events
import { subscribeStoreEvents } from "./events/store/store_events.js";
import { subscribeLiveKitEvents } from "./events/livekit/livekit_events.js";

// Импортируем handlers
import { menuHandler } from "./handlers/menu.js";
import { toggleAudioHandler } from "./handlers/toggle_audio.js";
import { toggleVideoHandler } from "./handlers/toggle_video.js";
import { switchCameraHandler } from "./handlers/switch_camera.js";
import { toggleScreenHandler } from "./handlers/toggle_screen.js";
import { toggleHandHandler } from "./handlers/toggle_hand.js";
import { unlockAudioHandler } from "./handlers/unlock_audio.js";
import { gridSettingsHandler } from "./handlers/grid_settings.js";

// Импортируем requests
import { openRequest } from "./requests/open.js";

// Импортиваем functions
import { connect } from "./functions/connect.js";
import { setConnecting } from "./functions/set_connecting.js";
import { startTimer, stopTimer } from "./functions/start_timer.js";
import { toggleImmersive } from "./functions/toggle_immersive.js";
import { bindKeyboardShortcuts } from "./functions/keyboard_shortcuts.js";
import { resolveLayout, emptyBlocks } from "./functions/parse_room_state.js";
import { loadPinned } from "./functions/pinned_storage.js";
import { getSessionUserId } from "./functions/session_identity.js";
import type { MeetQualityLevel } from "./functions/apply_connection_quality.js";
import { loadLocalLayout } from "../meet-grid-settings/handlers/save.js";

// Импортируем типы
import type { MeetInfo, MeetLayout, MeetRoomState, MeetBlocks, MeetBlocksMap, MeetParticipantItem, MeetVideoSettings, MeetScreenSettings } from "./types.js";

/**
 * Данные формы конференции.
 */
export interface MeetPlayData {

    /** Id конференции. */
    meetId?: string;

    /** Token LiveKit для доступа. */
    token?: string;

    /** Настройки формы. */
    options?: {

        /** Куда вставить форму. */
        insertInto?: HTMLElement | null;
    };

}

/**
 * ***************************************************************************
 * MeetPlay - Форма конференции на базе LiveKit.
 * Показывает сетку участников, управляет локальными камерой/микрофоном/экраном
 * и хранит подписки на события комнаты и хранилища участников.
 * ***************************************************************************
 */
export class MeetPlay {

    /** Реестр всех открытых форм MeetPlay: { meetId: instance }. */
    static instances = new Map<string, MeetPlay>();

    /** Настройки формы. */
    options: { insertInto?: HTMLElement | null };

    /** Корневой элемент шаблона. */
    tpl: HTMLElement | null = null;

    /** Модальный оверлей формы. */
    modal: Overlay | null = null;

    /** Контейнер контента. */
    content: HTMLElement | null = null;

    /** Список участников. */
    list: HTMLElement | null = null;

    /** overlayScroll instance списка. */
    osListScrollInstance: ReturnType<typeof OverlayScrollbars> | null = null;

    /** Функция отписки от глобального слушателя разблокировки аудио. */
    unlockAudioCleanup: (() => void) | null = null;

    /** Флаг закрытия: нужен, чтобы событие Disconnected не показывало
     *  тост об ошибке, когда пользователь сам вышел из конференции. */
    isClosing: boolean = false;

    /** Идёт ли подключение к комнате. Пока идёт — показываем
     *  оверлей вместо пустой сетки (см. setConnecting). */
    isConnecting: boolean = false;

    /** Таймер длительности конференции в шапке. */
    durationTimer: ReturnType<typeof setInterval> | null = null;

    /** Immersive-режим: шапка и футер уехали, осталась одна сетка.
     *  Включается пунктом меню, снимается по Escape. */
    isImmersive: boolean = false;

    /** Функция отписки от глобальных горячих клавиш. */
    keyboardCleanup: (() => void) | null = null;

    /** Текущий уровень качества связи: null — индикатор скрыт. */
    qualityLevel: MeetQualityLevel | null = null;

    /** Identity участника, которого этот клиент сделал главным.
     *  Личный выбор, а не модерация: закреплённого показывают крупно
     *  только тому, кто его выбрал, ровно как в Zoom или Meet. Поэтому
     *  в `room.metadata` он не пишется — принудительный режим сетки
     *  остаётся единственной вещью, которую создатель навязывает
     *  всем, и личный закреплённый с ним не конфликтует.
     *  null — никто не закреплён. Сохраняется в sessionStorage по id
     *  конференции: переживает перезаход, но не переносится на другую
     *  встречу (см. functions/pinned_storage.ts) */
    pinnedIdentity: string | null = null;

    /** Id конференции. */
    meetId: string;

    /** Данные конференции из ответа сервера. */
    meet: MeetInfo | null = null;

    /** Токен входа в комнату LiveKit. */
    token: string | null = null;

    /** Комната LiveKit. */
    room: Room | null = null;

    /** Настройки качества по умолчанию для камеры. */
    videoSettings: MeetVideoSettings;

    /** Настройки качества по умолчанию для экрана. */
    screenSettings: MeetScreenSettings;

    /** Состояние комнаты из room.metadata LiveKit: принудительный режим
     *  сетки, правило комнаты по запретам и карта точечных отступлений
     *  от него. Единственный источник правды: обновляется из
     *  RoomEvent.RoomMetadataChanged (см. apply_room_state.ts).
     *  Итоговые флаги участника — `resolveStateBlocks(form.roomState, identity)`. */
    roomState: MeetRoomState;

    /** Карта точечных блокировок участников (identity → флаги). */
    blocks: MeetBlocksMap = {};

    /** Правило комнаты по блокировкам (defaults из room.metadata). */
    defaultBlocks: MeetBlocks = emptyBlocks();

    /** Принудительный режим сетки от организатора (null — не задан)
     *  и личный выбор участника. Итог: forcedLayout ?? localLayout. */
    forcedLayout: MeetLayout | null = null;

    /** Личный выбор режима сетки участника. */
    localLayout: MeetLayout | null = null;

    /** Итоговый режим сетки (принудительный перекрывает личный). */
    layout: MeetLayout;

    /** Принудительный фокус от организатора: identity того,
     *  кого он сделал крупным у всех. null — не задан. */
    forcedFocus: string | null = null;

    /** Хранилище списка участников. */
    store: Store<MeetParticipantItem>;

    /** Таймер «усадки» сетки после перерисовки (см. apply_layout.ts). */
    settleTimer: ReturnType<typeof setTimeout> | null = null;

    /**
     * ***************************************************************************
     * Форма.
     * @param data - Данные формы.
     * ***************************************************************************
     */
    constructor(data: MeetPlayData) {

        // Если не переданы данные
        if (!data?.meetId) throw new Error("Не передан: meetId");

        // Устанавливаем настройки
        this.options = {
            insertInto: document.querySelector<HTMLElement>(".cdm-form.home .middle >.form-container"),
            ...data?.options
        }

        // Переменные формы
        this.meetId = data.meetId;
        this.pinnedIdentity = loadPinned(data.meetId);

        // LiveKit переменные (токен опционален — нормализуем к «нет»)
        this.token = data.token ?? null;
        this.room = null;

        // Настройки качества по умолчанию для камеры
        this.videoSettings = {
            facingMode: "user" // "environment"
        };

        // Настройки качества по умолчанию для экрана
        this.screenSettings = {
            resolution: ScreenSharePresets.h1080fps30.resolution,
            captureAudio: true
        };

        // Состояние комнаты и личный выбор режима сетки
        this.roomState = { layout: null, focus: null, defaults: emptyBlocks(), blocks: {} };
        this.localLayout = loadLocalLayout();
        this.layout = resolveLayout(this.forcedLayout, this.localLayout);

        // Хранилище списка участников
        this.store = new Store<MeetParticipantItem>();

        // Получаем instance
        let instance = MeetPlay.instances.get(data.meetId);
        if (instance) return instance;

        // Регистрируем этот экземпляр формы
        MeetPlay.instances.set(this.meetId, this);

        // Инициализация
        this._init();

    }

    // ***************************************************************************
    // Инициализация
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Создаёт комнату LiveKit, подписывается на события и открывает форму.
     * @returns Промис инициализации.
     * ***************************************************************************
     */
    async _init(): Promise<void> {

        // Создаем объект комнаты LiveKit
        this.room = new Room({
            adaptiveStream: true,
            dynacast: true,
            // DTX выключен: при закрытом гейте в энкодер идёт цифровая
            // тишина, а с DTX приёмник синтезирует comfort noise -
            // «шипение тишины» в паузах
            publishDefaults: {
                dtx: false
            },
            videoCaptureDefaults: {
                resolution: VideoPresets.h720.resolution,
            }
        });

        // Подписываемся на события Store.
        subscribeStoreEvents(this);

        // Подписываемся на события LiveKit.
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

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "form",
                url: `?meet-play=${this.meetId}`,
                insertInto: this.options.insertInto,
                closeOnEsc: false,
                closeOnOverlay: false,
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: () => this._onOpen(),
                onBeforeClose: () => this._onBeforeClose(),
                // Анимация открытия/закрытия выключена: пресеты формы
                // читают `.animation`, и null даёт ровно тот же эффект,
                // что и прежняя пустая строка — оверлей открывается мгновенно
                openAnimationClass: null,
                closeAnimationClass: null
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
    /**
     * ***************************************************************************
     * Вешает обработчики кнопок шапки, пагинации и футера.
     * @returns {void}
     * ***************************************************************************
     */
    _handlers(): void {

        try {

            // ---------- РАЗБЛОКИРОВКА АУДИО ----------
            // Браузеры (особенно iOS Safari) не дают запустить аудиоконтекст
            // без жеста пользователя. Слушатель снимается первым же кликом,
            // а функция отписки нужна, если форму закрыли раньше.
            this.unlockAudioCleanup = unlockAudioHandler(this);
            // ---------- РАЗБЛОКИРОВКА АУДИО ----------

            // Обработчики вешаются на узлы шаблона — без него нечего слушать
            if (!this.tpl) return;

            // Закрыть
            let close = this.tpl.querySelector(":scope >.header [action-close]");
            close?.addEventListener("click", () => this.modal?.close());

            // Контекстное меню
            let menu = this.tpl.querySelector(":scope >.header [action-menu]");
            menu?.addEventListener("click", (event) => menuHandler(event, this));

            // Открыть чат
            let openChat = this.tpl.querySelector(":scope >.header [action-open-chat]");
            openChat?.addEventListener("click", () => {
                // Ссылка в замыкании читается в момент клика
                const meet = this.meet;
                if (meet) new Messages({ channelId: meet.chat_channel_id });
            });

            // Настройки сетки. Отдельная кнопка в шапке, потому что
            // режим сетки переключают часто, а в меню он спрятан
            // тремя уровнями вложенности
            this.tpl.querySelector(":scope >.header [action-grid-settings]")
                ?.addEventListener("click", () => gridSettingsHandler(this));

            // Отмена подключения. Кнопка есть только в оверлее, который
            // живёт ровно до первого успешного connect, поэтому
            // отдельного состояния «отменено» не требуется
            this.tpl.querySelector(":scope >.content [action-cancel-connecting]")
                ?.addEventListener("click", () => this.modal?.close());

            // ---------- ФУТЕР ----------
            // Ссылки на сами кнопки больше не нужны: их иконками и
            // доступностью занимается единая updateFooter, которой хватает
            // form.tpl. Поэтому вешаем обработчики прямо на найденный узел
            // и не плодим в форме поля-переменные, которые никто не читает.

            // Переключить видео
            this.tpl.querySelector("[action-toggle-video]")
                ?.addEventListener("click", () => toggleVideoHandler(this));

            // Переключить камеру
            this.tpl.querySelector("[action-switch-camera]")
                ?.addEventListener("click", (event) => switchCameraHandler(event, this));

            // Переключить аудио
            this.tpl.querySelector("[action-toggle-audio]")
                ?.addEventListener("click", () => toggleAudioHandler(this));

            // Переключить screenshare
            this.tpl.querySelector("[action-toggle-screen]")
                ?.addEventListener("click", () => toggleScreenHandler(this));

            // Поднять/опустить руку
            this.tpl.querySelector("[action-toggle-hand]")
                ?.addEventListener("click", () => toggleHandHandler(this));

            // Покинуть комнату
            this.tpl.querySelector("[action-leave]")?.addEventListener("click", () => this.modal?.close());
            // ---------- ФУТЕР ----------

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Настройка формы
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Запрашивает данные конференции, готовит список и скролл.
     * При ошибке показывает тост и закрывает форму: оставаться в «пустой»
     * конференции бессмысленно.
     * @returns Промис настройки.
     * ***************************************************************************
     */
    async _onBeforeOpen(): Promise<void> {

        try {

            // Получаем трансляцию
            let response = await openRequest({
                meet_id: this.meetId
            });

            // Обновляем форму
            this._update(response.data);

            // Устанавливаем элементы. Без шаблона открываться нечему —
            // как и в легаси, закрываем форму
            if (!this.tpl) {
                this.modal?.close();
                return;
            }
            this.content = this.tpl.querySelector<HTMLElement>(":scope >.content");
            this.list = this.tpl.querySelector<HTMLElement>(":scope >.content [data-list]");

            // Инициализируем скролл
            const content = this.content;
            if (content) {
                this.osListScrollInstance = OverlayScrollbars(content, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
            }

            // Пока идёт подключение, вместо пустой сетки показываем
            // оверлей с текстом и отменой (см. setConnecting)
            setConnecting(this, true);

            // Сообщаем системе, что форма открыта
            window.dispatchEvent(new CustomEvent("[app][form]::opened", {
                detail: {
                    id: this.modal?.options.id,
                    data: {
                        instance: this,
                        title: this.meet?.name || window._lc.forms.meet_play.title,
                        subtitle: window._lc.forms.meet_play.title
                    }
                }
            }));

        } catch (error) {
            Logger.error("[meet-play] Ошибка открытия конференции:", error);

            // Toast
            Toast.error(window._lc.forms.meet_play.toasts.open_error);

            // Закрываем форму: без данных конференции она всё равно не рабочая
            this.modal?.close();

        }

    }

    // ***************************************************************************
    // Форма открылась
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Включает обработчики и подключается к комнате LiveKit.
     * @returns Промис открытия.
     * ***************************************************************************
     */
    async _onOpen(): Promise<void> {

        // Включаем обработчики
        this._handlers();

        // Горячие клавиши. Вешаем после открытия, чтобы они не мешали
        // вводить текст в ещё не отрисованных диалогах, и обязательно
        // снимаем в _onBeforeClose
        this.keyboardCleanup = bindKeyboardShortcuts(this);

        // Таймер длительности конференции. Запускаем до подключения:
        // отсчёт идёт от created_at и не зависит от состояния комнаты,
        // а ждать ради него начала сетки смысла нет
        startTimer(this);

        // Подключаемся к серверу
        if (this.token) {
            await connect(this);
        } else {
            // Без токена connect не зовётся, а значит не спрячет
            // оверлей подключения — и пользователь навсегда увидит
            // «Подключение…» с кнопкой отмены
            Logger.warn("[meet-play] Не получен токен LiveKit, подключение не выполняется");
            setConnecting(this, false);
        }

    }

    // ***************************************************************************
    // Обновляем данные формы
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Геттер `isCreator` - Организатор конференции (модератор —
     * только он). Правило комнаты организатора не касается, поэтому признак
     * нужен в нескольких местах: футер, плитки, меню.
     *
     * Именно геттер, а не поле в `_update`: сессия заполняется
     * при инициализации приложения, и вычисление признака в момент прихода
     * данных один раз и навсегда запирало бы его в `false`, если порядок
     * инициализации окажется другим. На стенде это выглядело так: правило
     * комнаты гасило футер организатора и рисовало запреты у участников.
     * @returns true, если текущий пользователь создал конференцию.
     * ***************************************************************************
     */
    get isCreator(): boolean {

        return this.meet?.created_user_id === getSessionUserId();

    }

    /**
     * ***************************************************************************
     * Применяет данные конференции к шаблону.
     * @param data - Данные конференции из ответа сервера.
     * @returns {void}
     * ***************************************************************************
     */
    _update(data: MeetInfo): void {

        // ---------- UPDATE ----------
        // Обновляем данные формы
        this.meet = data;
        this.token = data?.token ?? null;

        // ---------- UPDATE ----------

        // Без шаблона обновлять нечего
        if (!this.tpl) return;

        // ---------- ЗАГОЛОВОК ----------
        // Название конференции. Раньше здесь стояла статичная строка
        // «Конференция», и в шапке с вкладками все конференции
        // выглядели одинаково
        const title = this.tpl.querySelector(":scope >.header [data-title]");
        if (title) title.textContent = this.meet?.name || window._lc.forms.meet_play.title;
        // ---------- ЗАГОЛОВОК ----------

        // ---------- CHAT ----------
        // Кнопка чата есть в шаблоне всегда, но при is_chat = false её нужно скрыть
        let openChat = this.tpl.querySelector(":scope >.header [action-open-chat]");
        if (openChat) {
            openChat.classList.toggle("hidden", !this.meet?.is_chat);
        }
        // ---------- CHAT ----------

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Отписывается от комнаты, чистит подписки и хранилище, снимает форму с реестра.
     * @returns {void}
     * ***************************************************************************
     */
    _onBeforeClose(): void {

        // ---------- CLEANUP ----------
        // Флаг нужен обработчику Disconnected: без него выход по кнопке
        // «Покинуть» показывал бы тост об ошибке соединения.
        this.isClosing = true;

        // Снимаем глобальный слушатель разблокировки аудио, если он ещё висит
        this.unlockAudioCleanup?.();
        this.unlockAudioCleanup = null;

        // Горячие клавиши снимаем обязательно: они висят на document,
        // и без отписки Space/V/S/M продолжали бы срабатывать в других
        // формах — например, вводить символ «м» в поиск по сообщениям
        this.keyboardCleanup?.();
        this.keyboardCleanup = null;

        // Возвращаем шапку и футер на место: с формой они уедут в
        // разметку повторного открытия, где CSS ждёт видимых панелей
        toggleImmersive(this, false);

        // Останавливаем таймер: форма может переоткрыться, и старый
        // interval продолжил бы писать в уже отключённый DOM
        stopTimer(this);

        // Отключаемся от комнаты при закрытии формы
        if (this.room) this.room.disconnect();

        // Убираем карточки участников и их подписки на обновления
        this.store?.removeAll();
        // ---------- CLEANUP ----------

        // Удаляем экземпляр формы из реестра
        MeetPlay.instances.delete(this.meetId);

        // Сообщаем системе, что форма закрыта
        window.dispatchEvent(new CustomEvent("[app][form]::closed", {
            detail: { id: this.modal?.options.id }
        }));

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
    _template(): HTMLElement {

        const root = new DOMParser().parseFromString(`

            <div class="cdm-form meet-play flex flex-col h-full ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">

                    <!-- Слева: выход и название конференции с числом
                         участников и таймером длительности -->
                    <div class="flex flex-row gap-2 items-center min-w-0 flex-1">
                        ${Buttons.transparent({ shape: "circle", attributes: ["action-close", "aria-label=" + window._lc.forms.meet_play.close], icon: "ArrowLeft" })}
                        <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                            <span data-title class="font-semibold text-[0.95rem] leading-tight truncate"></span>
                            <div class="flex flex-row items-center gap-2 text-xs text-secondary leading-tight">
                                <span data-participants-count class="hidden"></span>
                                <span data-timer class="tabular-nums"></span>
                            </div>
                        </div>
                    </div>

                    <!-- Справа: качество связи, режим сетки, чат, меню -->
                    <div class="flex flex-row gap-1 items-center shrink-0">
                        <div data-connection-quality class="hidden flex flex-row items-center gap-1.5 rounded-full px-2 py-1 text-xs" role="status" aria-live="polite">
                            <span data-quality-icon class="flex items-center"></span>
                            <span data-quality-label class="max-lg:hidden"></span>
                        </div>
                        ${Buttons.transparent({ shape: "circle", attributes: ["action-grid-settings", "title=" + window._lc.forms.meet_play.grid_settings_button, "aria-label=" + window._lc.forms.meet_play.grid_settings_button], icon: "layout-grid" })}
                        ${Buttons.transparent({ shape: "circle", attributes: ["action-open-chat", "title=" + window._lc.forms.meet_play.open_chat, "aria-label=" + window._lc.forms.meet_play.open_chat], icon: "message-2" })}
                        ${Buttons.transparent({ shape: "circle", attributes: ["action-menu", "title=" + window._lc.forms.meet_play.menu_button, "aria-label=" + window._lc.forms.meet_play.menu_button, "aria-haspopup=menu"], icon: "dots-vertical" })}
                    </div>
                </div>

                <div class="content w-full h-full flex-1 overflow-hidden relative ${CDM_FORM_CONTENT_CLASSES()}">

                    <!-- Режим сетки (grid / spotlight / sidebar / presentation)
                         задаётся классом meet-layout-* из apply_layout.ts.
                         Колонки и отступы описаны в css/forms/meet-play.css:
                         набор классов в шаблоне менялся бы при каждой
                         смене режима, а так переключение — одно
                         переключение класса.

                         Список не нарезан по страницам: все участники
                         комнаты видны разом, лишнее убирается скроллом. -->
                    <div data-list class="meet-layout-grid" role="list" aria-label="${window._lc.forms.meet_play.participants_list}"></div>

                    <!-- Оверлей подключения. Живой текст, а не картинка:
                         скринридер читает его, а тост об ошибке не
                         заменяет его на экране надолго -->
                    <div data-connecting class="hidden absolute inset-0 z-10 flex flex-col gap-4 items-center justify-center">
                        <span data-connecting-text class="text-sm text-secondary" role="status" aria-live="polite"></span>
                        ${Buttons.transparent({ attributes: ["action-cancel-connecting", "title=" + window._lc.forms.meet_play.cancel_connecting], text: window._lc.forms.meet_play.cancel_connecting })}
                    </div>
                </div>

                <!-- Футер. Сама панель прозрачная и не перехватывает
                     клики, а кнопки собраны в «пилюлю» поверх сетки:
                     так видео уходит в самый низ формы, а управление
                     всё равно на расстоянии большого пальца -->
                <div class="footer flex flex-row justify-center items-center p-3">
                    <div class="bar flex flex-row gap-1.5 items-center rounded-full p-1.5">
                        ${Buttons.circle({ intent: "transparent", attributes: ["action-toggle-audio"], icon: "microphone-off" })}
                        ${Buttons.circle({ intent: "transparent", attributes: ["action-toggle-video"], icon: "video-off" })}
                        ${Buttons.circle({ intent: "transparent", attributes: ["action-switch-camera", "title=" + window._lc.forms.meet_play.footer.switch_camera, "aria-label=" + window._lc.forms.meet_play.footer.switch_camera], icon: "camera-rotate" })}
                        ${Buttons.circle({ intent: "transparent", attributes: ["action-toggle-screen"], icon: "device-desktop-off" })}
                        ${Buttons.circle({ intent: "transparent", attributes: ["action-toggle-hand", "title=" + window._lc.forms.meet_play.footer.raise_hand, "aria-label=" + window._lc.forms.meet_play.footer.raise_hand], icon: "hand-finger" })}
                        ${Buttons.danger({ shape: "circle", attributes: ["action-leave", "title=" + window._lc.forms.meet_play.footer.leave, "aria-label=" + window._lc.forms.meet_play.footer.leave], icon: "PhoneOff" })}
                    </div>
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

        // invariant: шаблон — наши строки, корневой .cdm-form в нём всегда есть
        if (!(root instanceof HTMLElement)) {
            throw new TypeError("MeetPlay: шаблон .cdm-form не найден");
        }

        return root;

    }

}
