// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES, CDM_FORM_SECTION_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { Toggle } from "../../components/toggle.js";

// Импортируем forms
import { MeetPlay } from "../meet-play/index.js";

// Импортируем handlers
import { saveGridSettingsHandler } from "./handlers/save.js";
import { loadLocalLayout } from "./handlers/save.js";

// Импортируем functions
import { LAYOUTS } from "../meet-play/functions/parse_room_state.js";
import { SHORTCUTS } from "../meet-play/functions/shortcuts.js";
import { getSessionUserId } from "../meet-play/functions/session_identity.js";

// Импортируем типы
import { isMeetLayout } from "../meet-play/types.js";
import type { MeetLayout } from "../meet-play/types.js";
import { I18n, t } from "../../utils/i18n/index.js";

/**
 * Иконки режимов сетки. Ключ совпадает со значением режима.
 */
const LAYOUT_ICONS: Record<MeetLayout, string> = {
    grid: "layout-grid",
    spotlight: "layout-board-split",
    sidebar: "layout-sidebar-right",
    presentation: "presentation"
};

/**
 * Данные формы настроек сетки.
 */
export interface MeetGridSettingsData {

    /** Id конференции. */
    meetId?: string;

    /** Настройки формы. */
    options?: {

        /** Куда вставить форма (контейнер формы конференции). */
        insertInto?: HTMLElement | null;
    };

}

/**
 * Временное хранилище выбранных значений в форме.
 */
export interface MeetGridSettingsState {

    /** Выбранный режим сетки. */
    layout: MeetLayout;

    /** Гейт «применить для всех» (только у создателя). */
    force: boolean;

    /** Чекбокс «показать меня крупно всем». */
    focus: boolean;

}

/**
 * ***************************************************************************
 * MeetGridSettings - Форма выбора режима отображения сетки участников.
 *
 * Личный выбор применяется только к текущему пользователю. Создатель
 * конференции дополнительно может навязать режим всем участникам —
 * тогда выбор уезжает на сервер и живёт в metadata комнаты.
 * ***************************************************************************
 */
export class MeetGridSettings {

    /** Единственный экземпляр формы. */
    static instance: MeetGridSettings | null = null;

    /** Форма конференции, в которую вложена эта форма. */
    meetPlayForm: MeetPlay | null = null;

    /** Настройки формы. */
    options: { insertInto?: HTMLElement | null };

    /** Корневой элемент шаблона. */
    tpl: HTMLElement | null = null;

    /** Оверлей формы. */
    modal: Overlay | null = null;

    /** overlayScroll instance списка. */
    osListScrollInstance: ReturnType<typeof OverlayScrollbars> | null = null;

    /** Контейнер контента. */
    content: HTMLElement | null = null;

    /** Id конференции. */
    meetId: string;

    /** Пользователь создал конференцию. */
    isCreator: boolean;

    /** Identity организатора в комнате LiveKit. */
    selfIdentity: string | null = null;

    /** Временное хранилище выбранных значений. */
    currentSettings: MeetGridSettingsState;

    /**
     * ***************************************************************************
     * Форма.
     * @param data - Данные формы.
     * ***************************************************************************
     */
    constructor(data: MeetGridSettingsData) {

        // Если не передан meetId
        if (!data?.meetId) throw new Error("Не передан: meetId");

        // Поиск открытого окна конференции
        this.meetPlayForm = MeetPlay.instances.get(data.meetId) ?? null;
        const insertInto = this.meetPlayForm?.modal?.content || null;

        // Устанавливаем настройки
        this.options = {
            insertInto,
            ...data?.options
        }

        // Переменные формы
        this.meetId = data.meetId;

        // Принудительный режим доступен только создателю конференции
        this.isCreator = this.meetPlayForm?.meet?.created_user_id === getSessionUserId();

        // Identity организатора в комнате LiveKit — она же user_id. Нужна,
        // чтобы сравнить её с принудительным фокусом из metadata: правило
        // указывает на identity, а не на «создателя» из базы
        this.selfIdentity = this.meetPlayForm?.room?.localParticipant?.identity || null;

        // Временное хранилище выбранных значений. Берём текущие из формы,
        // чтобы форма открывался уже с актуальным режимом, а не с дефолтом.
        // Гейт «применить для всех» тоже обязан отражать реальность: раньше он
        // всегда был снят, и создатель, сняв его при включённом режиме,
        // получал молчаливый no-op — запрос не уходил, а `forcedLayout`
        // продолжал побеждать личный выбор
        const defaultLayout = LAYOUTS[0];
        if (!defaultLayout) throw new Error("Не найден дефолтный layout");
        this.currentSettings = {
            layout: this.meetPlayForm?.layout || loadLocalLayout() || defaultLayout,
            force: this.isCreator && isMeetLayout(this.meetPlayForm?.forcedLayout),
            // Принудительный фокус отмечен, только если он уже
            // указывает на меня самого: правило в комнате хранит identity, а
            // «у всех главный я» — это ровно моя identity
            focus: this.isCreator && this.meetPlayForm?.forcedFocus === this.selfIdentity
        };

        // Проверяем, существует ли уже экземпляр
        if (MeetGridSettings.instance) {
            return MeetGridSettings.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        MeetGridSettings.instance = this;

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

            // Компонент сам следит, чтобы атрибут `checked` не разъехался
            // с реальным состоянием radio после клика пользователя
            Toggle.hydrate(this.tpl);

            // ---------- CLOSE ----------
            // Закрыть
            const close = this.tpl.querySelector(":scope >.header [action-close]");
            close?.addEventListener("click", () => this.modal?.close());
            // ---------- CLOSE ----------

            // ---------- LAYOUTS ----------
            // Выбор режима. Слушаем `change` на самом radio, а не клик по
            // карточке: клик по <label> браузер сам превращает в отметку
            // radio, а событие `change` срабатывает один раз и только
            // при реальном изменении выбора (повторный клик по выбранному
            // режиму ничего не меняет — и не должен)
            this.tpl.querySelectorAll<HTMLInputElement>("[data-layout]").forEach(radio => {
                radio.addEventListener("change", () => this.selectLayout(radio.dataset.layout));
            });
            // ---------- LAYOUTS ----------

            // ---------- FORCE ----------
            // Применить для всех — только создателю конференции
            const force = this.tpl.querySelector<HTMLInputElement>("[data-force]");
            force?.addEventListener("change", () => {
                this.currentSettings.force = force.checked;
            });
            // ---------- FORCE ----------

            // ---------- FOCUS ----------
            // Чекбокс «показать меня крупно всем». Блок
            // целиком скрыт в режиме `grid`: там крупной плитки нет, и
            // галочка обещала бы то, чего на экране не произойдёт
            const focus = this.tpl.querySelector<HTMLInputElement>("[data-focus]");
            focus?.addEventListener("change", () => {
                this.currentSettings.focus = focus.checked;
            });
            // ---------- FOCUS ----------

            // ---------- SAVE ----------
            // Сохранить
            this.tpl.querySelector(":scope >.header [action-save]")?.addEventListener("click", () => saveGridSettingsHandler(this));
            // ---------- SAVE ----------

        } catch (error) {
            Logger.error(error);
        }

    }

    /**
     * ***************************************************************************
     * Отмечает выбранный режим в форме.
     * @param layout - Режим сетки.
     * @returns {void}
     * ***************************************************************************
     */
    selectLayout(layout?: string): void {

        // Проверяем по списку режимов, а не поиском карточки в разметке.
        // Поиск по `data-layout` сработал бы и на пустом значении — такой
        // селектор находит сразу все карточки разом, проверка прошла бы, а
        // в currentSettings лёг бы мусор, и «Сохранить» завершился бы
        // тихим no-op. По белому списку мусор отсекается сам.
        if (!isMeetLayout(layout)) return;

        this.currentSettings.layout = layout;
        this._renderSelection();
        this._renderFocusBlock();

    }

    /**
     * ***************************************************************************
     * Показывает или прячет блок принудительного фокуса.
     *
     * Отдельный метод, а не правка внутри `selectLayout`, потому что блок
     * должен быть скрыт и при первом открытии формы: на `grid` он
     * обещал бы крупную плитку, которой в этом режиме не бывает.
     * @private
     * @returns {void}
     * ***************************************************************************
     */
    _renderFocusBlock(): void {

        const block = this.tpl?.querySelector("[data-focus-block]");
        if (!block) return;

        // `grid` — единственный режим без крупной плитки. Класс `hidden`
        // ставим без других display-утилит: в собранном CSS они идут по
        // алфавиту, и `hidden flex` показывал бы блок всегда
        block.classList.toggle("hidden", this.currentSettings.layout === "grid");

    }

    /**
     * ***************************************************************************
     * Проставляет отметку выбранного режима.
     *
     * Меняем только состояние самих radio — внешний вид карточки
     * вычисляется стилями через `has-checked:`, поэтому дублировать
     * выбор классами не нужно.
     * @private
     * @returns {void}
     * ***************************************************************************
     */
    _renderSelection(): void {

        // Элементы задаются шаблоном — без него нечего отмечать
        if (!this.tpl) return;

        this.tpl.querySelectorAll<HTMLInputElement>("[data-layout]").forEach(radio => {
            radio.checked = radio.dataset.layout === this.currentSettings.layout;
        });

    }

    // ***************************************************************************
    // Настройка формы
    // ***************************************************************************
    /**
     * ***************************************************************************
     * Готовит элементы и скролл до показа формы.
     * @returns Промис подготовки.
     * ***************************************************************************
     */
    async _onBeforeOpen(): Promise<void> {

        try {

            // Элементы заполняются из шаблона — без него нечего настраивать
            if (!this.tpl) return;

            // Устанавливаем элементы
            this.content = this.tpl.querySelector(":scope >.content");

            // Помечаем выбранный режим до показа, иначе форма
            // на мгновение мигнёт дефолтом
            this._renderSelection();

            // И сразу прячем блок фокуса, если режим без крупной плитки
            this._renderFocusBlock();

            // Инициализируем скролл (скролл-контейнер входит в шаблон)
            const content = this.content;
            if (content) {
                this.osListScrollInstance = OverlayScrollbars(content, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
            }

            // Активируем переключатели
            Toggle.hydrate(this.tpl);

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

        // Включаем обработчики
        this._handlers();

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
        MeetGridSettings.instance = null;

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

        // ---------- LOCALES ----------
        // Индексируем строкой из SHORTCUTS, поэтому объявляем карта как
        // произвольные строки: сам объект локализации при этом остаётся
        // типизированным ru.json
        const hotkeyLocales: Record<string, string> = I18n.tree.forms.meet_play.dialogs.grid_settings.hotkeys_map || {};
        // ---------- LOCALES ----------

        // ---------- OPTIONS ----------
        // Карточки режимов — штатный компонент `Toggle.cardGroup`, тот же, что в
        // настройках оформления. Отметку выбранного он рисует сам через
        // `has-checked:`, поэтому JS не дублирует выбор классами: иначе
        // разметка и состояние разъедутся при любом несинхронном обновлении
        // формы. `data-layout` едет на самом radio — по нему и слушаем
        // выбор, и проверяем, что режим вообще есть в разметке
        const options = Toggle.cardGroup(LAYOUTS.map(layout => ({
            name: "layout",
            value: layout,
            icon: LAYOUT_ICONS[layout] || "layout-grid",
            text: I18n.tree.forms.meet_play.dialogs.grid_settings.layouts[layout],
            description: I18n.tree.forms.meet_play.dialogs.grid_settings.layout_description[layout],
            // Значение обязано ехать в атрибуте: обработчик читает выбор
            // именно отсюда, а не из замыкания. Голое «data-layout» поставило
            // бы его пустым, и режим не переключался бы вообще
            attributes: [{ name: "data-layout", value: layout }]
        })));
        // ---------- OPTIONS ----------

        // ---------- FORCE ----------
        // Блок принудительного применения есть только у создателя конференции:
        // остальным показывать нечего, сервер всё равно откажет.
        // Обёрнут в карточку second-bg — как и остальные секции формы
        const forceBlock = this.isCreator ? `
            <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                ${Toggle.checkbox({
            name: "force-layout",
            checked: this.currentSettings.force,
            attributes: ["data-force"],
            text: t("forms.meet_play.dialogs.grid_settings.force"),
            description: t("forms.meet_play.dialogs.grid_settings.force_description")
        }).html}
            </div>
        ` : "";
        // ---------- FORCE ----------

        // ---------- FOCUS ----------
        // Блок принудительного фокуса есть только у создателя:
        // остальным показывать нечего, сервер всё равно откажет.
        // На `grid` он скрыт — см. `_renderFocusBlock`. Обёрнут в карточку
        // second-bg — `data-focus-block` остался на обёртке, скрытие работает
        const focusBlock = this.isCreator ? `
            <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}" data-focus-block>
                ${Toggle.checkbox({
            name: "force-focus",
            checked: this.currentSettings.focus,
            attributes: ["data-focus"],
            text: t("forms.meet_play.dialogs.grid_settings.focus"),
            description: t("forms.meet_play.dialogs.grid_settings.focus_description")
        }).html}
            </div>
        ` : "";
        // ---------- FOCUS ----------

        // ---------- HOTKEYS ----------
        // Подсказка рисуется из SHORTCUTS — того же списка, по которому
        // реально работают горячие клавиши. Дублировать строки в локализации
        // значило бы через месяц получить подсказку «V — видео» и обработчик
        // на другой клавише.
        const hotkeyItems = SHORTCUTS.map(shortcut => `
            <div class="flex flex-row items-center gap-2">
                <kbd class="min-w-[3.5rem] text-center rounded border border-[var(--border-color)] bg-[var(--second-bg)] px-1.5 py-0.5 font-mono text-xs">${shortcut.label}</kbd>
                <span class="text-secondary">${hotkeyLocales[shortcut.locale] || ""}</span>
            </div>
        `).join("");
        // ---------- HOTKEYS ----------

        const root = new DOMParser().parseFromString(`

            <div class="cdm-form meet-grid-settings flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "ArrowLeft" })}
                    <span class="flex-1 font-semibold text-base truncate">${t("forms.meet_play.dialogs.grid_settings.title")}</span>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-save"], icon: "device-floppy" })}
                </div>
                <div class="content w-full h-full flex ${CDM_FORM_CONTENT_CLASSES()}">
                    <div class="flex flex-col gap-3 p-3 max-w-[var(--form-max-content-width)] m-auto w-full">
                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            ${options}
                        </div>
                        ${forceBlock}
                        ${focusBlock}
                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="text-xs font-semibold text-secondary">${t("forms.meet_play.dialogs.grid_settings.hotkeys")}</span>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">${hotkeyItems}</div>
                        </div>
                    </div>
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

        // invariant: шаблон — наши строки, корневой .cdm-form в нём всегда есть
        if (!(root instanceof HTMLElement)) {
            throw new TypeError("MeetGridSettings: шаблон .cdm-form не найден");
        }

        return root;

    }

}
