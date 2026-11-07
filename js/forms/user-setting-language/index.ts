// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES, CDM_FORM_SECTION_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { t } from "../../utils/i18n/index.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";

// Импортируем forms
import { UserSettings } from "../user-settings/index.js";

// Импортируем functions
import { renderLanguages } from "./functions/render_languages.js";

// Импортируем handlers
import { selectLanguageHandler } from "./handlers/select.js";

/**
 * Данные конструктора формы.
 */
export interface UserSettingLanguageData {

    /** Id пользователя. */
    userId: string;

}

// Form
export class UserSettingLanguage {

    // Переменная для хранения единственного экземпляра формы
    static instance: UserSettingLanguage | null = null;

    /** Id пользователя. */
    userId: string;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Контент формы (скролл-контейнер OverlayScrollbars). */
    content: HTMLElement | null = null;

    /** Инстанс OverlayScrollbars списка. */
    osListScrollInstance: OverlayScrollbars | null = null;

    /** Куда вставить форму (контент открытых настроек). */
    insertInto: HTMLElement | null = null;

    /**
     * ***************************************************************************
     * Форма выбора языка интерфейса: список доступных языков, при выборе —
     * диалог подтверждения, после него язык сменяется на месте.
     * @param data - Данные.
     * @param data.userId - Id пользователя.
     * ***************************************************************************
     */
    constructor(data: UserSettingLanguageData) {

        // Если не передан userId
        if (!data?.userId) throw new Error("Не передан: userId");

        // Поиск открытых настроек: форма языка открывается внутри них
        this.insertInto = UserSettings.instance?.modal?.content || null;

        // Устанавливаем настройки
        this.userId = data.userId;

        // Проверяем, существует ли уже экземпляр
        if (UserSettingLanguage.instance) {
            return UserSettingLanguage.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        UserSettingLanguage.instance = this;

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

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "form",
                url: `?user-setting-language=${this.userId}`,
                insertInto: this.insertInto,
                closeOnEsc: false,
                closeOnOverlay: false,
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: () => this._onOpen(),
                onBeforeClose: () => this._onBeforeClose()
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

            // Обработчики вешаются на узлы шаблона — без него нечего слушать
            if (!this.tpl) return;

            // Закрыть
            const close = this.tpl.querySelector(":scope >.header [action-close]");
            close?.addEventListener("click", () => this.modal?.close());

            // Выбор языка. Слушаем change на самом radio, а не клик по
            // карточке: клик по <label> браузер сам превращает в отметку,
            // а событие change срабатывает только при реальном изменении
            this.tpl.querySelectorAll<HTMLInputElement>(":scope >.content [data-language]").forEach((radio) => {
                radio.addEventListener("change", () => selectLanguageHandler(this, radio.dataset.language, radio.dataset.name));
            });

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Настройка формы
    // ***************************************************************************
    async _onBeforeOpen(): Promise<void> {

        try {

            // Элементы заполняются из шаблона — без него нечего настраивать
            if (!this.tpl) return;

            // Устанавливаем элементы
            const content = this.tpl.querySelector<HTMLElement>(":scope >.content");
            this.content = content;

            // Инициализируем скролл (скролл-контейнер входит в шаблон)
            if (content) {
                this.osListScrollInstance = OverlayScrollbars(content, {
                    scrollbars: { autoHide: "scroll" }, overflow: { x: "hidden", y: "scroll" }
                });
            }

            // Список языков: лениво подключает ещё не загруженные локали
            await renderLanguages(this);

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Форма открылась
    // ***************************************************************************
    _onOpen(): void {

        this._handlers();

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Удаляем экземпляр формы
        UserSettingLanguage.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement {

        // invariant: корневой .cdm-form входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`

            <div class="cdm-form user-setting-language flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.create({
                        intent: "transparent",
                        shape: "circle",
                        attributes: ["action-close"],
                        icon: "ArrowLeft"
                    })}
                </div>
                 <div class="content w-full h-full flex ${CDM_FORM_CONTENT_CLASSES()}">

                    <div class="flex flex-col gap-3 p-3 max-w-[var(--form-max-content-width)] m-auto w-full">

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">${t("forms.user_setting_language.title")}</span>
                            <span class="text-sm text-secondary">${t("forms.user_setting_language.desc")}</span>
                            <div class="flex flex-col gap-2" data-language-list></div>
                        </div>

                    </div>

                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form")!;

    }

}
