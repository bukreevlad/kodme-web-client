// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES, CDM_FORM_SECTION_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Icons } from "../../utils/icons.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";

// Импортируем forms
import { MeetPlay } from "../meet-play/index.js";

// Импортируем handlers
import { selectDeviceHandler } from "./handlers/select_device.js";
import { toggleNoiseSuppressionHandler } from "./handlers/toggle_noise_suppression.js";

// Импортируем functions
import { ensureAccess } from "./functions/ensure_access.js";
import { renderDevices } from "./functions/render_devices.js";

/**
 * Данные формы выбора камеры и микрофона.
 */
export interface MeetDeviceSettingsData {

    /** Id конференции. */
    meetId?: string;

    /** Настройки формы. */
    options?: {

        /** Куда вставить форма (контейнер формы конференции). */
        insertInto?: HTMLElement | null;
    };

}

/**
 * ***************************************************************************
 * MeetDeviceSettings - Форма выбора камеры и микрофона.
 *
 * Отдельная форма от `screen-settings` по одной причине: там настройки
 * применяются кнопкой «Сохранить», потому что это параметры качества
 * следующей трансляции. Здесь выбор устройства применяется сразу и по
 * одному нажатию — как в Zoom, Meet и в самом LiveKit: кнопка
 * «Сохранить» рядом со списком из двух устройств выглядела бы
 * канцеляритом, а «Отмена» означала бы лишний выбор из двух состояний.
 *
 * Список устройств — системный, он приходит из браузера. Запроса к
 * серверу нет и быть не может: конференция работает на P2P-топологии
 * LiveKit, сервер про камеры и микрофоны не знает ничего.
 * ***************************************************************************
 */
export class MeetDeviceSettings {

    /** Единственный экземпляр формы. */
    static instance: MeetDeviceSettings | null = null;

    /** Форма конференции, в которую вложена эта форма. */
    meetPlayForm: MeetPlay | null = null;

    /** Настройки формы. */
    options: { insertInto?: HTMLElement | null };

    /** Корневой элемент шаблона. */
    tpl: HTMLElement | null = null;

    /** Оверлей формы. */
    modal: Overlay | null = null;

    /** Контейнер контента. */
    content: HTMLElement | null = null;

    /** overlayScroll instance контента. */
    osListScrollInstance: ReturnType<typeof OverlayScrollbars> | null = null;

    /** Id конференции. */
    meetId: string;

    /** Идёт ли сейчас переключение устройства: защита от того, что
     *  два быстрых выбора уедут в LiveKit одновременно (см. _handlers) */
    switching: boolean = false;

    /**
     * ***************************************************************************
     * Форма.
     * @param data - Данные формы.
     * ***************************************************************************
     */
    constructor(data: MeetDeviceSettingsData) {

        // Если не передан meetId
        if (!data?.meetId) throw new Error("Не передан: meetId");

        // Поиск открытого окна конференции (реестр отдаёт undefined при
        // промахе — поле формы хранит null)
        this.meetPlayForm = MeetPlay.instances.get(data.meetId) ?? null;
        let insertInto = this.meetPlayForm?.modal?.content || null;

        // Устанавливаем настройки
        this.options = {
            insertInto,
            ...data?.options
        };

        // Переменные формы
        this.meetId = data.meetId;

        // Проверяем, существует ли уже экземпляр
        if (MeetDeviceSettings.instance) {
            return MeetDeviceSettings.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        MeetDeviceSettings.instance = this;

        // Инициализация
        this._init();

    }

    // ***************************************************************************
    // Инициализация
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Открывает форма.
     * @returns Промис открытия.
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
     * @returns Промис открытия.
     * ***************************************************************************
     */
    async _open(): Promise<void> {

        try {

            // Шаблон формы
            this.tpl = this._template();

            // Форма настроек
            this.modal = new Overlay(this.tpl, {
                type: "form",
                insertInto: this.options.insertInto,
                closeOnEsc: false,
                closeOnOverlay: false,
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: () => this._onOpen(),
                onBeforeClose: () => this._onBeforeClose(),
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
     * Вешает обработчики элементов формы.
     * @returns {void}
     * ***************************************************************************
     */
    _handlers(): void {

        try {

            // Обработчики вешаются на узлы шаблона — без него нечего слушать
            if (!this.tpl) return;

            // ---------- CLOSE ----------
            // Закрыть
            let close = this.tpl.querySelector(":scope >.header [action-close]");
            close?.addEventListener("click", () => this.modal?.close());
            // ---------- CLOSE ----------

            // ---------- DEVICES ----------
            // Один слушатель на контейнер, а не на каждую строку:
            // renderDevices пересобирает список целиком, и слушатели,
            // навешенные на элементы, после первой же перерисовки
            // остались бы на узлах, которых в DOM уже нет.
            //
            // Событие — `change` на самом radio, а не клик по строке:
            // строка это <label>, и клик браузер сам превращает в отметку
            // радиокнопки, поэтому `change` срабатывает один раз и только
            // при реальном изменении выбора. Клик ловить пришлось бы ещё
            // и отсекать второй вызов от <label> (см. `switching` ниже)
            this.tpl.querySelector(":scope >.content")?.addEventListener("change", async (event) => {

                const radio = event.target;

                // Событие change целятся в элемент; чужой тип без
                // dataset/matches отбрасываем — раньше это делал
                // необязательный вызов `radio?.matches?.()`
                if (!(radio instanceof HTMLInputElement)) return;
                if (!radio.matches("input[type='radio'][data-device-id]")) return;

                // `switchActiveDevice` останавливает и перезапускает трек,
                // поэтому два быстрых переключения подряд должны ждать
                // друг друга, а не стартовать одновременно
                if (this.switching) return;
                this.switching = true;

                try {
                    await selectDeviceHandler(this, radio.dataset.kind, radio.dataset.deviceId);
                } finally {
                    this.switching = false;
                }

            });
            // ---------- DEVICES ----------

            // ---------- NOISE ----------
            // Слушатель висит на слоте, а не на самом инпуте: содержимое
            // слота пересобирается при каждой отрисовке формы (списки
            // перерисовываются после каждого переключения устройства),
            // а сам слот живёт в шаблоне всегда. Событие `change` с
            // чекбокса тумблера всплывает до контейнера - это то же
            // делегирование, что и у списка устройств выше
            this.tpl.querySelector(":scope [data-noise]")?.addEventListener("change", async (event) => {

                const input = event.target;

                // Как и выше: интересен только чекбокс из нашего шаблона
                if (!(input instanceof HTMLInputElement)) return;
                if (!input.matches("input[type='checkbox'][name='noise-suppression']")) return;

                await toggleNoiseSuppressionHandler(this, input.checked);

            });
            // ---------- NOISE ----------

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Настройка формы
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Запрашивает доступ и рисует списки устройств до показа окна.
     * @returns Промис подготовки.
     * ***************************************************************************
     */
    async _onBeforeOpen(): Promise<void> {

        try {

            // Элементы заполняются из шаблона — без него нечего настраивать
            if (!this.tpl) return;

            // Устанавливаем элементы
            this.content = this.tpl.querySelector(":scope >.content");

            // Сначала доступ, потом список. Без первого браузер отдаёт
            // устройства с пустым deviceId, и список получается пустым
            // (см. комментарий в ensure_access.ts). Запрашиваем именно
            // здесь, а не внутри renderDevices: тот вызывается ещё и после
            // каждого переключения, и лишний захват камеры при уже
            // опубликованном видео — это риск, а не мелочь
            const access = await ensureAccess();

            // Список устройств — асинхронный. Рисуем до показа формы:
            // она, сначала мигающая пустым и потом заполняющаяся,
            // выглядела бы как ошибка загрузки
            await renderDevices(this, { access });

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
    /**
     * ***************************************************************************
     * Включает обработчики после открытия.
     * @returns {void}
     * ***************************************************************************
     */
    async _onOpen(): Promise<void> {

        try {

            // Включаем обработчики
            this._handlers();

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Снимает экземпляр формы.
     * @returns {void}
     * ***************************************************************************
     */
    _onBeforeClose(): void {

        // Удаляем экземпляр формы
        MeetDeviceSettings.instance = null;

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

        const locales = window._lc.forms.meet_play.dialogs.device_settings;

        // Списки пустые: наполняет renderDevices. Без него остались бы
        // заголовки без единого устройства (см. комментарий там)
        const root = new DOMParser().parseFromString(`

            <div class="cdm-form meet-device-settings flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "ArrowLeft" })}
                    <span class="flex-1 font-semibold text-base truncate">${locales.title}</span>
                </div>
                <div class="content w-full h-full flex ${CDM_FORM_CONTENT_CLASSES()}">
                    <div class="flex flex-col gap-3 p-3 max-w-[var(--form-max-content-width)] m-auto w-full">
                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("video", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${locales.cameras}
                            </span>
                            <div class="flex flex-col gap-1 max-h-48 overflow-y-auto" data-cameras></div>
                        </div>
                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("microphone", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${locales.microphones}
                            </span>
                            <div class="flex flex-col gap-1 max-h-48 overflow-y-auto" data-microphones></div>
                        </div>
                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("noise-reduction", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${locales.noise}
                            </span>
                            <div class="flex flex-col gap-1" data-noise></div>
                        </div>
                        <p class="text-xs text-secondary">${locales.hint}</p>
                    </div>
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

        // invariant: шаблон — наши строки, корневой .cdm-form в нём всегда есть
        if (!(root instanceof HTMLElement)) {
            throw new TypeError("MeetDeviceSettings: шаблон .cdm-form не найден");
        }

        return root;

    }

}
