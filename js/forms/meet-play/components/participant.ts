// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { Icons } from "../../../utils/icons.js";

// Импортируем components
import { Buttons } from "../../../components/buttons.js";
import { VideoPlayer } from "../../../components/video_player.js";
import { Avatars } from "../../../components/avatars.js";

// Импортируем handlers
import { removeParticipantHandler } from "./handlers/remove.js";
import { participantMenuHandler } from "./handlers/participant_menu.js";

// Импортиваем functions
import { renderTracks } from "./functions/render_tracks.js";
import { renderAvatar, hasCameraVideo } from "./functions/render_avatar.js";
import { renderHand } from "./functions/render_hand.js";
import { renderPin } from "./functions/render_pin.js";
import { mainIdentity } from "../functions/main_identity.js";
import { getSessionUserId } from "../functions/session_identity.js";
import { BLOCK_FLAGS, hasAnyBlock, resolveStateBlocks } from "../functions/parse_room_state.js";

// Импортируем типы
import { isMeetParticipantItem } from "../types.js";
import type { MeetPlay } from "../index.js";
import type { MeetBlockFlag, MeetParticipantItem } from "../types.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * Иконки бейджей блокировки по флагам.
 */
const BLOCK_ICONS: Record<MeetBlockFlag, string> = {
    audio: "microphone-off",
    video: "video-off",
    screen: "screen-share-off"
};

/**
 * ***************************************************************************
 * ParticipantItem - Плитка одного участника конференции: видео (камера и/или
 *                   демонстрация экрана), индикатор речи, статус микрофона
 *                   и кнопка удаления (только у создателя конференции).
 * ***************************************************************************
 */
export class ParticipantItem {

    /** Форма-владелец плитки. */
    form: MeetPlay;

    /** Данные элемента (содержат participant LiveKit). */
    data: MeetParticipantItem;

    /** Корневой DOM-элемент плитки. */
    element: HTMLElement;

    /** Слот под видео LiveKit. */
    videoSlot: HTMLElement | null = null;

    /** Обводка активно говорящего. */
    speakingLine: HTMLElement | null = null;

    /** Подпись имени участника. */
    nameEl: HTMLElement | null = null;

    /** Индикатор микрофона. */
    micStatusEl: HTMLElement | null = null;

    /** Контейнер бейджей блокировок. */
    blocksEl: HTMLElement | null = null;

    /** Кнопка удаления участника. */
    removeButton: HTMLElement | null = null;

    /** Экземпляры VideoPlayer поверх <video> LiveKit. Ключ — SID видеотрека:
     *  у участника их может быть несколько одновременно (камера + экран). */
    players = new Map<string, VideoPlayer>();

    /** Экземпляр Avatars-заглушки (держит состояние акронима). */
    avatar: Avatars | null = null;

    /**
     * ***************************************************************************
     * constructor - Создаёт плитку участника, вешает обработчики и подписки.
     * @param form - Экземпляр формы конференции.
     * @param data - Данные элемента (содержат participant LiveKit).
     * ***************************************************************************
     */
    constructor(form: MeetPlay, data: MeetParticipantItem) {

        // Записываем данные
        this.form = form;
        this.data = data;

        // Создаем DOM-элемент из шаблона
        this.element = this._template();

        // Identity в data-атрибуте: по нему applyLayout раскладывает
        // плитки по крупной и полосе, не заглядывая в хранилище
        this.element.dataset.identity = data?.participant?.identity || String(data?.id || "");

        // Записываем ссылку на dom элемент
        if (!this.data.__domElements__) {
            this.data.__domElements__ = [];
        }
        this.data.__domElements__.push(this.element);

        // Быстрые ссылки на элементы
        this.videoSlot = this.element.querySelector(":scope [data-video]");
        this.speakingLine = this.element.querySelector(":scope [data-speaking]");
        this.nameEl = this.element.querySelector(":scope [data-name]");
        this.micStatusEl = this.element.querySelector(":scope [data-mic-status]");
        this.blocksEl = this.element.querySelector(":scope [data-blocks]");
        this.removeButton = this.element.querySelector(":scope [action-remove]");

        // Устанавливаем начальные данные
        this._setup(this.data);

        // Прикрепляем обработчики событий
        this._actions();

        // Подписываем на обновление
        this._subscribeToUpdates();

    }

    /**
     * ***************************************************************************
     * _template - HTML-шаблон плитки участника.
     * @private
     * @returns Корневой элемент плитки.
     * ***************************************************************************
     */
    _template(): HTMLElement {

        // Мы используем <template> tag или DOMParser для создания DOM без innerHTML
        const root = new DOMParser().parseFromString(`
            <div class="item relative flex flex-col gap-0 p-0 cursor-pointer overflow-hidden" role="listitem">
                <div data-video class="relative flex flex-col gap-0 self-center items-center justify-center w-full h-full aspect-4/3 overflow-hidden">
                    <!-- Заглушка с акронимом участника на время, пока нет
                         кадров с камеры. Заполняется в renderAvatar.
                         Идёт первым, поэтому видео, смонтированное
                         позже в этот же слот, оказывается поверх. -->
                    <div data-avatar class="absolute z-0 flex items-center justify-center"></div>
                    <!-- Обводка поверх видео. Используем токен темы
                         --color-brand: у Tailwind в проекте нет палитры
                         brand-500, класс ring-brand-500 не генерировался. -->
                    <div data-speaking class="absolute hidden inset-0 z-1 ring-2 ring-inset ring-[var(--color-brand)] rounded-xl pointer-events-none"></div>
                </div>
                <!-- Значок поднятой руки. Слева сверху: бейджи запретов
                     организатора живут справа, и два ряда углов не спорят.
                     Видимость переключает renderHand. -->
                <div data-hand class="hidden absolute top-2 left-2 z-2 flex items-center pointer-events-none"></div>
                <!-- Бейджи блокировок, установленных организатором.
                     Пустой контейнер, поэтому при отсутствии блокировок
                     он не занимает места (см. _setup). -->
                <div data-blocks class="absolute top-2 right-2 z-2 flex flex-row gap-1 items-center pointer-events-none"></div>
                <div class="info absolute left-2 bottom-2 z-2 flex w-fit max-w-[calc(100%-1rem)] flex-row items-center gap-2 px-2 py-1 text-xs text-white">
                    <div class="flex flex-row items-center gap-1.5 min-w-0">
                        <span data-mic-status class="flex shrink-0 items-center">${Icons.icon("microphone")?.outerHTML}</span>
                        <span data-name class="truncate"></span>
                        <!-- Значок закрепления. В подписи имени, а не
                             в углу плитки: углы заняты значком руки и бейджами
                             запретов, а обводка — индикатором говорящего.
                             Видимость переключает renderPin. -->
                        <span data-pin class="hidden shrink-0 items-center opacity-80"></span>
                    </div>
                    ${Buttons.circle({ intent: "transparent", attributes: ["action-remove", "title=" + t("forms.meet_play.context_menu.remove"), "aria-label=" + t("forms.meet_play.context_menu.remove")], icon: "trash", classes: ["shrink-0", "w-6", "h-6"] })}
                </div>
            </div>
        `, "text/html").querySelector<HTMLElement>(".item");

        // invariant: шаблон — наши строки, корневой .item в нём всегда есть
        if (!(root instanceof HTMLElement)) {
            throw new TypeError("MeetPlay: шаблон .item не найден");
        }

        return root;

    }

    /**
     * ***************************************************************************
     * _setup - Перерисовывает плитку под актуальные данные участника.
     * @private
     * @param data - Данные элемента (содержат participant LiveKit).
     * @returns {void}
     * ***************************************************************************
     */
    _setup(data: MeetParticipantItem): void {

        try {

            // Сохраняем актуальные данные
            this.data = data;
            const participant = this.data?.participant;
            if (!participant) return;

            // Локальный ли это участник?
            const isLocal = participant.identity === this.form?.room?.localParticipant?.identity;

            // Имя
            if (this.nameEl) {
                const displayName = participant.name || participant.identity || t("forms.meet_play.participant_fallback");
                const label = isLocal
                    ? `${displayName} (${t("forms.meet_play.you_suffix")})`
                    : displayName;

                this.nameEl.textContent = label;

                // Подпись нужна не только зрячим: без неё скринридер
                // читает двадцать плиток подряд как «список из
                // двадцати безымянных элементов» и понять, кто говорит,
                // невозможно
                this.element?.setAttribute("aria-label", label);
            }

            // Индикатор активного микрофона
            if (this.speakingLine) {
                if (participant.isSpeaking) {
                    this.speakingLine.classList.remove("hidden");
                } else {
                    this.speakingLine.classList.add("hidden");
                }
            }

            // Статус микрофона (включен/выключен аппаратно); без иконки
            // элемент остаётся пустым
            if (this.micStatusEl) {
                const isMicOn = participant.isMicrophoneEnabled;
                const micIcon = isMicOn ? Icons.icon("microphone") : Icons.icon("microphone-off");
                this.micStatusEl.innerHTML = micIcon?.outerHTML ?? "";
            }

            // Рендер треков (видео/аудио)
            renderTracks(this);

            // Заглушка с акронимом, если нет камеры. Проверяем именно
            // наличие трека, а не `isCameraEnabled`: опубликованная, но
            // ещё не пришедшая камера тоже должна показывать аватар,
            // иначе плитка мигает чёрным до первого кадра.
            renderAvatar(this, !hasCameraVideo(this));

            // Бейджи блокировок, установленных организатором.
            // Читаем состояние из room.metadata через form.roomState: оно обновляется
            // событием RoomMetadataChanged, а этот метод вызывается и при
            // каждом обновлении плитки, так что бейджи всегда актуальны.
            this._renderBlocks(participant.identity);

            // Значок поднятой руки. Состояние живёт в метаданных
            // участника, поэтому перерисовывается на каждом обновлении
            // плитки и по событию ParticipantMetadataChanged
            renderHand(this);

            // Значок закрепления. Состояние личное и лежит на
            // форме, поэтому рисуется при каждой перерисовке плитки —
            // в том числе при входе в конференцию, когда закреплённый
            // поднят из sessionStorage
            renderPin(this.element, mainIdentity(this.form) === participant.identity);

            // Кнопка удаления доступна только создателю конференции
            // и только на чужой плитке: себя удалить
            // сервер всё равно не даст (CANNOT_REMOVE_OWNER).
            if (this.removeButton) {
                const isViewerCreator = this.form?.meet?.created_user_id === getSessionUserId();

                this.removeButton.classList.toggle("hidden", !isViewerCreator || isLocal);
            }

        } catch (error) {
            Logger.error("🚨 [app][_setup]: Ошибка инициализации участника:", error);
        }

    }

    /**
     * ***************************************************************************
     * _renderBlocks - Перерисовывает бейджи источников, запрещённых
     *                 организатором этому участнику.
     * @private
     * @param identity - Identity участника в комнате LiveKit.
     * @returns {void}
     * ***************************************************************************
     */
    _renderBlocks(identity?: string): void {

        // Блокировать трансляции нечем — у неё нет клиента
        if (!this.blocksEl) return;

        const blocks = resolveStateBlocks(this.form?.roomState, identity);

        // Ничего не запрещено — очищаем контейнер и не рисуем рамку
        if (!hasAnyBlock(blocks)) {
            if (this.blocksEl.childElementCount) this.blocksEl.innerHTML = "";
            this.element?.classList.remove("meet-play-tile-blocked");
            return;
        }

        // По одной иконке на каждый запрещённый источник
        this.blocksEl.innerHTML = BLOCK_FLAGS
            .filter(flag => blocks[flag])
            .map(flag => Icons.icon(BLOCK_ICONS[flag], {
                classes: ["meet-play-block-badge"],
                settings: { size: 16 }
            })?.outerHTML)
            .join("");

        // Подсветка рамкой плитки: видно, даже если бейджи перекрыла
        // трансляция с экрана
        this.element?.classList.add("meet-play-tile-blocked");

    }

    /**
     * ***************************************************************************
     * _actions - Привязка обработчиков к элементам плитки.
     * @private
     * @returns {void}
     * ***************************************************************************
     */
    _actions(): void {

        // Удаление участника
        this.removeButton?.addEventListener("click", (event) => {
            event.stopPropagation();
            removeParticipantHandler(this.form, this.data?.participant);
        })

        // ---------- КОНТЕКСТНОЕ МЕНЮ ----------
        // ПКМ: стандартное поведение браузера отменяется обработчиком
        this.element?.addEventListener("contextmenu", (event) => {
            participantMenuHandler(event, this.form, this.data?.participant, this.element);
        });

        // Мобильные: долгое нажатие открывает то же меню. Без него
        // закрепить плитку и заблокировать участника на телефоне нечем.
        this._bindLongPress();

        // Клавиатура: то же меню по Enter, пробелу и клавише меню.
        // Фокус и роль кнопки выдаём всем, у кого в меню есть хоть один
        // пункт: у всех — закрепление крупной плитки есть
        // у каждого участника, и прятать единственный доступный ему
        // способ изменить вид конференции с клавиатуры было бы
        // недоступностью. Цена — по одной остановке табуляции на
        // плитку; снимать её иначе нельзя, не убрав действие.
        this.element?.setAttribute("tabindex", "0");
        this.element?.setAttribute("aria-haspopup", "menu");

        this.element?.addEventListener("keydown", (event) => {
            if (!["Enter", " ", "Spacebar", "ContextMenu"].includes(event.key)) return;

            event.preventDefault();

            // Обработчик меню ждёт координаты курсора, а у клавиатуры
            // курсора нет — отдаём центр плитки
            const rect = this.element.getBoundingClientRect();

            participantMenuHandler({
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2,
                preventDefault: () => { }
            }, this.form, this.data?.participant, this.element);
        });
        // ---------- КОНТЕКСТНОЕ МЕНЮ ----------

    }

    /**
     * ***************************************************************************
     * _bindLongPress - Открывает контекстное меню по долгому нажатию.
     *
     * На тач-устройствах нет правой кнопки мыши, а показывать отдельную
     * кнопку «меню» на каждой плитке — лишняя визуальная нагрузка. Таймер
     * обязателен: без него тап открывал бы меню мгновенно и обычный тап
     * по своей плитке стал бы невозможен.
     *
     * Вешается всем, а не только создателю: в меню есть пункт
     * «Сделать главным», доступный каждому.
     * @private
     * @returns {void}
     * ***************************************************************************
     */
    _bindLongPress(): void {

        const LONG_PRESS_MS = 450;
        let timer: ReturnType<typeof setTimeout> | null = null;
        let startX = 0;
        let startY = 0;

        // Сбрасываем таймер при отмене: палец увели в сторону, открывать нечего
        const cancel = () => {
            if (timer) clearTimeout(timer);
            timer = null;
        };

        this.element?.addEventListener("touchstart", (event) => {
            const touch = event.changedTouches?.[0];
            if (!touch) return;

            startX = touch.clientX;
            startY = touch.clientY;

            cancel();
            timer = setTimeout(() => {
                timer = null;
                participantMenuHandler(event, this.form, this.data?.participant, this.element);
            }, LONG_PRESS_MS);

        }, { passive: true });

        // Палец сдвинулся — это скролл, а не удержание
        this.element?.addEventListener("touchmove", (event) => {
            const touch = event.changedTouches?.[0];
            if (!touch) return;
            if (Math.abs(touch.clientX - startX) > 10 || Math.abs(touch.clientY - startY) > 10) cancel();
        }, { passive: true });

        this.element?.addEventListener("touchend", cancel, { passive: true });
        this.element?.addEventListener("touchcancel", cancel, { passive: true });

    }

    /**
     * ***************************************************************************
     * update - Публичное обновление плитки новыми данными.
     * @param data - Новые данные элемента.
     * @returns {void}
     * ***************************************************************************
     */
    update(data: MeetParticipantItem): void {

        // Передаем новые данные в _setup, чтобы перерисовать DOM
        this._setup(data);

    }

    /**
     * ***************************************************************************
     * _subscribeToUpdates - Подписка на точечное событие обновления плитки.
     * @private
     * @returns {void}
     * ***************************************************************************
     */
    _subscribeToUpdates(): void {

        try {

            // Формируем уникальное имя события
            const itemUpdatedEvent: `item::updated::${string}` = `item::updated::${this.data.id}`;

            // Подписываемся и сохраняем функцию отписки
            const unsubscribe = this.form.store.on(itemUpdatedEvent, async (data) => {

                // Guard: payload события — данные участника
                if (!isMeetParticipantItem(data)) return;

                // Обновляем данные
                this.update(data);

            });

            // Сохраняем функцию отписки в data, чтобы Main мог вызвать ее при удалении
            this.data.__unsubscribeStore__ = unsubscribe;

        } catch (error) {
            Logger.error(error);
        }

    }

    /**
     * ***************************************************************************
     * getDOM - Геттер корневого DOM-элемента плитки.
     * @returns Элемент плитки.
     * ***************************************************************************
     */
    getDOM(): HTMLElement {
        return this.element;
    }

    /**
     * ***************************************************************************
     * getData - Геттер данных плитки.
     * @returns Данные элемента.
     * ***************************************************************************
     */
    getData(): MeetParticipantItem {
        return this.data;
    }

}

/**
 * ***************************************************************************
 * createParticipantItem - Создаёт плитку участника и возвращает её корневой
 *                         DOM-элемент для вставки в список.
 *
 * Конструктор класса элемент не возвращает (в TS конструктор возвращает
 * только экземпляр), поэтому сборка DOM вынесена в фабрику — ровно один
 * участок, где класс превращается в элемент.
 * @param form - Экземпляр формы конференции.
 * @param data - Данные элемента (содержат participant LiveKit).
 * @returns Корневой элемент плитки.
 * ***************************************************************************
 */
export function createParticipantItem(form: MeetPlay, data: MeetParticipantItem): HTMLElement {

    return new ParticipantItem(form, data).getDOM();

}
