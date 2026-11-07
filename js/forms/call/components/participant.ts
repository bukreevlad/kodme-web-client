// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { Icons } from "../../../utils/icons.js";

// Импортируем handlers
import { switchStageHandler } from "../handlers/switch_stage.js";

// Импортируем functions
import { renderTracks } from "./functions/render_tracks.js";
import { renderParticipantAvatar, hasCameraVideo } from "./functions/render_avatar.js";

// Импортируем components
import { VideoPlayer } from "../../../components/video_player.js";
import { Avatars } from "../../../components/avatars.js";

// Импортируем типы
import { isCallParticipantData } from "../types.js";
import type { CallParticipantData } from "../types.js";
import type { Call } from "../index.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * ***************************************************************************
 * ParticipantItem - плитка участника звонка (только удалённые участники).
 *
 * Локальный пользователь в сетку не попадает: он живёт в отдельной
 * движимой плашке «я». В отличие от встреч, здесь нет ни модерации, ни
 * меню участника — единственное действие по клику это показать плитку
 * крупно (и обратно). Трансляции экрана не бывает в принципе.
 * ***************************************************************************
 */
export class ParticipantItem {

    /** Форма-владелец плитки. */
    form: Call;

    /** Данные участника. */
    data: CallParticipantData;

    /** Корневой DOM-элемент плитки (задаётся в конструкторе из шаблона). */
    element: HTMLElement;

    /** Слот под видео LiveKit. */
    videoSlot: HTMLElement | null = null;

    /** Подпись имени участника. */
    nameEl: HTMLElement | null = null;

    /** Индикатор микрофона. */
    micStatusEl: HTMLElement | null = null;

    /** Значок крупного показа. */
    pinEl: HTMLElement | null = null;

    /** Экземпляры VideoPlayer поверх <video> LiveKit. Ключ — SID видеотрека. */
    players = new Map<string, VideoPlayer>();

    /** Реестр аудиоэлементов участника (см. renderTracks). */
    audioIds = new Set<string>();

    /** Экземпляр Avatars заглушки (дрержит состояние акронима). */
    avatar: Avatars | null = null;

    /**
     * ***************************************************************************
     * Конструктор.
     * @param form - Экземпляр формы звонка.
     * @param data - Данные элемента (содержат participant LiveKit).
     * ***************************************************************************
     */
    constructor(form: Call, data: CallParticipantData) {

        // Записываем данные
        this.form = form;
        this.data = data;

        // Создаем DOM-элемент из шаблона
        this.element = this._template();

        // Identity в data-атрибуте: по нему apply_view_mode.ts раскладывает
        // плитки по крупной и полосе, не заглядывая в хранилище
        this.element.dataset.identity = data?.participant?.identity || data?.id || "";

        // Записываем ссылку на dom элемент
        if (!this.data.__domElements__) {
            this.data.__domElements__ = [];
        }
        this.data.__domElements__.push(this.element);

        // Быстрые ссылки на элементы
        this.videoSlot = this.element.querySelector<HTMLElement>(":scope [data-video]");
        this.nameEl = this.element.querySelector<HTMLElement>(":scope [data-name]");
        this.micStatusEl = this.element.querySelector<HTMLElement>(":scope [data-mic-status]");
        this.pinEl = this.element.querySelector<HTMLElement>(":scope [data-pin]");

        // Устанавливаем начальные данные
        this._setup(this.data);

        // Прикрепляем обработчики событий
        this._actions();

        // Подписываем на обновление
        this._subscribeToUpdates();

    }

    /**
     * ***************************************************************************
     * Возвращает корневой DOM-элемент плитки для вставки в список.
     * @returns Корневой элемент плитки.
     * ***************************************************************************
     */
    getDOM(): HTMLElement | null {

        return this.element;

    }

    /**
     * ***************************************************************************
     * HTML-шаблон плитки участника.
     * @returns Корневой элемент плитки.
     * ***************************************************************************
     */
    _template(): HTMLElement {

        // invariant: корневой .item входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`
            <div class="item relative flex flex-col gap-0 p-0 cursor-pointer overflow-hidden" role="listitem">
                <div data-video class="relative flex flex-col gap-0 self-center items-center justify-center w-full h-full aspect-4/3 overflow-hidden">
                    <!-- Заглушка с акронимом участника на время, пока нет
                         кадров с камеры. Заполняется в renderParticipantAvatar.
                         Идёт первым, поэтому видео, смонтированное позже
                         в этот же слот, оказывается поверх. -->
                    <div data-avatar class="absolute z-0 flex items-center justify-center"></div>
                </div>
                <div class="info absolute left-2 bottom-2 z-2 flex w-fit max-w-[calc(100%-1rem)] flex-row items-center gap-2 px-2 py-1 text-xs text-white">
                    <div class="flex flex-row items-center gap-1.5 min-w-0">
                        <span data-mic-status class="flex shrink-0 items-center">${Icons.icon("microphone")?.outerHTML ?? ""}</span>
                        <span data-name class="truncate"></span>
                        <!-- Значок крупного показа: виден, когда именно эта
                             плитка развернута во весь экран -->
                        <span data-pin class="hidden shrink-0 items-center opacity-80"></span>
                    </div>
                </div>
            </div>
        `, "text/html").querySelector<HTMLElement>(".item")!;

    }

    /**
     * ***************************************************************************
     * Перерисовывает плитку под актуальные данные участника.
     * @param data - Данные элемента (содержат participant LiveKit).
     * ***************************************************************************
     */
    _setup(data: CallParticipantData): void {

        try {

            // Сохраняем актуальные данные
            this.data = data;
            const participant = this.data?.participant;
            if (!participant) return;

            // Локальный ли это участник?
            const isLocal = participant.identity === this.form?.room?.localParticipant?.identity;

            // Имя
            if (this.nameEl) {
                const displayName = participant.name || participant.identity || t("forms.call.participant");
                const label = isLocal
                    ? `${displayName} (${t("forms.call.you_suffix")})`
                    : displayName;

                this.nameEl.textContent = label;

                // Подпись нужна и скринридеру: без неё плитки читаются
                // как список безымянных элементов
                this.element?.setAttribute("aria-label", label);
            }

            // Индикатор активного микрофона
            if (this.micStatusEl) {
                this.micStatusEl.innerHTML = participant.isMicrophoneEnabled
                    ? Icons.icon("microphone")?.outerHTML ?? ""
                    : Icons.icon("microphone-off")?.outerHTML ?? "";
            }

            // Рендер треков (видео/аудио)
            renderTracks(this);

            // Заглушка с акронимом, если нет кадров с камеры
            renderParticipantAvatar(this, !hasCameraVideo(this));

            // Значок крупного показа: состояние личное и живёт на форме,
            // поэтому рисуется при каждой перерисовке плитки
            this._renderPin();

        } catch (error) {
            Logger.error("🚨 [app][call]: Ошибка инициализации участника:", error);
        }

    }

    /**
     * ***************************************************************************
     * Перерисовывает значок крупного показа плитки.
     * @returns {void}
     * ***************************************************************************
     */
    _renderPin(): void {

        if (!this.pinEl) return;

        const isFocused = this.form?.stageIdentity === this.data?.participant?.identity;
        this.pinEl.classList.toggle("hidden", !isFocused);
        this.pinEl.classList.toggle("flex", isFocused);

        if (isFocused) this.pinEl.innerHTML = Icons.icon("picture-in-picture", { classes: ["w-3.5", "h-3.5"] })?.outerHTML ?? "";

    }

    /**
     * ***************************************************************************
     * Обработчики плитки.
     *
     * Клик отправляет участника на сцену, а в личном звонке — меняет видео
     * местами (там угловая плитка и есть вторая половина пары). Плашка «я»
     * работает тем же обработчиком — см. handlers/switch_stage.ts.
     * @returns {void}
     * ***************************************************************************
     */
    _actions(): void {

        this.element?.addEventListener("click", () => {

            // Клик после перетаскивания: жест был направлен плитке как
            // управляющим позицией, а браузер донёс и клик. Флаг
            // «съедается», чтобы не заблокировать следующий клик
            if (this.form?.selfViewDragMoved) {
                this.form.selfViewDragMoved = false;
                return;
            }

            switchStageHandler(this.form, this.data?.participant?.identity, this.element);

        });

        // Клавиатура: та же плитка доступна по Enter и пробелу
        this.element?.setAttribute("tabindex", "0");
        this.element?.addEventListener("keydown", (event) => {
            if (!["Enter", " ", "Spacebar"].includes(event.key)) return;

            event.preventDefault();
            switchStageHandler(this.form, this.data?.participant?.identity, this.element);
        });

    }

    /**
     * ***************************************************************************
     * Публичное обновление плитки новыми данными.
     * @param data - Новые данные элемента.
     * ***************************************************************************
     */
    update(data: CallParticipantData): void {

        // Передаем новые данные в _setup, чтобы перерисовать DOM
        this._setup(data);

    }

    /**
     * ***************************************************************************
     * Подписка на точечное событие обновления плитки.
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
                if (!isCallParticipantData(data)) return;

                // Обновляем данные
                this.update(data);

            });

            // Сохраняем функцию отписки в data, чтобы событие удаления
            // элемента могло снять подписку (см. events/store/item_removed.ts)
            this.data.__unsubscribeStore__ = unsubscribe;

            // И саму карточку — по ней снимаются плееры и аудио участника
            this.data.__component__ = this;

        } catch (error) {
            Logger.error("🚨 [app][call]: Ошибка подписки на обновление участника:", error);
        }

    }

    /**
     * ***************************************************************************
     * Отписывается от обновлений и снимает плееры участника.
     *
     * Вызывается из событий Store при удалении элемента: без этого
     * `<audio>` с чужим голосом остался бы в документе и участника
     * было бы слышно после его выхода из звонка.
     * @returns {void}
     * ***************************************************************************
     */
    destroy(): void {

        try {

            // Отписка от обновления (тот же ключ, что и в _subscribeToUpdates)
            if (typeof this.data?.__unsubscribeStore__ === "function") {
                this.data.__unsubscribeStore__();
                this.data.__unsubscribeStore__ = null;
            }

            // Уничтожаем плееры и чистим видеослот
            Array.from(this.players.keys()).forEach((trackId) => {
                try {
                    this.players.get(trackId)?.destroy();
                } catch (error) {
                    Logger.warn("⚠️ [app][call]: Ошибка при уничтожении плеера:", error);
                }
            });
            this.players.clear();

            // Страховка: убираем остатки видео
            this.videoSlot?.querySelectorAll("video-player, video-skin, video").forEach((el) => el.remove());

            // Снимаем звук: аудиоэлементы живут в body вне формы
            if (this.audioIds) {
                this.audioIds.forEach((id) => document.getElementById(id)?.remove());
                this.audioIds.clear();
            }

        } catch (error) {
            Logger.error("🚨 [app][call]: Ошибка при уничтожении плитки участника:", error);
        }

    }

}
