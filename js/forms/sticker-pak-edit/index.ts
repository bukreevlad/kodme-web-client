// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES, CDM_FORM_SECTION_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Icons } from "../../utils/icons.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";
import { Inputs } from "../../components/inputs.js";
import { Toggle } from "../../components/toggle.js";
import { Toast } from "../../components/toast.js";

// Импортируем requests
import { getPakForEditRequest } from "./requests/get_pak.js";

// Импортируем handlers
import { stickerPakSaveHandler } from "./handlers/save.js";

/**
 * Настройки формы редактирования пака стикеров.
 */
export interface StickerPakEditOptions {

    /** Id пака. */
    pakId: string;

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

// Form
export class StickerPakEdit {

    // Переменная для хранения единственного экземпляра формы
    static instance: StickerPakEdit | null = null;

    /** Настройки формы. */
    options: StickerPakEditOptions;

    /** Id пака. */
    pakId: string;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Контент формы. */
    content: HTMLElement | null = null;

    /**
     * ***************************************************************************
     * Форма.
     * @param data - Данные.
     * @param data.pakId - Id пака.
     * @param data.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: StickerPakEditOptions) {

        // Устанавливаем настройки
        this.options = {
            insertInto: document.querySelector<HTMLElement>(".cdm-form.home .left"),
            ...data
        }

        // Id пака обязателен — без него редактировать нечего
        this.pakId = data.pakId;

        // Проверяем, существует ли уже экземпляр
        if (StickerPakEdit.instance) {
            return StickerPakEdit.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        StickerPakEdit.instance = this;

        // Инициализация
        this._init();

    }

    // **************************************************************************
    // Инициализация
    // **************************************************************************
    async _init(): Promise<void> {

        // Открытие
        await this._open();

    }

    // **************************************************************************
    // Открытие
    // **************************************************************************
    async _open(): Promise<void> {

        try {

            // Шаблон формы
            this.tpl = this._template();

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "form",
                url: `?stickers&edit=${this.pakId}`,
                insertInto: this.options.insertInto,
                closeOnEsc: false,
                closeOnOverlay: false,
                onBeforeOpen: async () => await this._onBeforeOpen(),
                onOpen: () => this._onOpen(),
                onBeforeClose: () => this._onBeforeClose()
            });

            // Открываем форму
            this.modal.open();

        } catch (error) {
            Logger.error("[app][sticker-pak-edit][open]:", error);
        }

    }

    // **************************************************************************
    // Обработчики
    // **************************************************************************
    _handlers(): void {

        try {

            // Обработчики вешаются на узлы шаблона — без него нечего слушать
            if (!this.tpl) return;

            // Закрыть
            const close = this.tpl.querySelector(`:scope >.header [action-close]`);
            close?.addEventListener("click", () => this.modal?.close());

            // Сохранить
            const save = this.tpl.querySelector(`:scope >.header [action-save]`);
            save?.addEventListener("click", () => stickerPakSaveHandler(this));

        } catch (error) {
            Logger.error("[app][sticker-pak-edit][handlers]:", error);
        }

    }

    // **************************************************************************
    // Настройка формы
    // **************************************************************************
    async _onBeforeOpen(): Promise<void> {

        try {

            // Элементы заполняются из шаблона — без него нечего настраивать
            if (!this.tpl) return;

            // Устанавливаем элементы
            this.content = this.tpl.querySelector(":scope >.content");

            // Активируем переключатели
            Toggle.hydrate(this.tpl);

            // Загружаем данные пака и предзаполняем поля
            await this._loadPak();

        } catch (error) {
            Logger.error("[app][sticker-pak-edit][before-open]:", error);
        }

    }

    // **************************************************************************
    // Приватная: загрузка данных пака и предзаполнение полей
    // **************************************************************************
    async _loadPak(): Promise<void> {

        try {

            // Запрос пака (ошибки сервера сокет пробрасывает reject'ом)
            const response = await getPakForEditRequest({ pak_id: this.pakId });

            // Неожиданный ответ — заполнять нечего
            if (!response?.data) return;

            // Редактировать пак может только автор — чужой закрываем сразу
            if (!response.data.is_author) {
                Toast.error(window._lc.api.errors.access_denied);
                this.modal?.close();
                return;
            }

            // Устанавливаем элементы
            const name = this.tpl?.querySelector<HTMLInputElement>(`:scope >.content [name="name"]`);
            const about = this.tpl?.querySelector<HTMLTextAreaElement>(`:scope >.content [name="about"]`);
            const isPublic = this.tpl?.querySelector<HTMLInputElement>(`:scope >.content [name="is-public"]`);

            // Предзаполняем поля текущими значениями пака
            if (name) name.value = response.data.name;
            if (about) about.value = response.data.about ?? "";
            if (isPublic) isPublic.checked = response.data.is_public;

        } catch (error) {

            // Пак недоступен — закрываем форму
            Logger.error("[app][sticker-pak-edit][load-pak]:", error);
            Toast.error(window._lc.forms.sticker_pak_edit.toasts.load_error);
            this.modal?.close();

        }

    }

    // **************************************************************************
    // Форма открылась
    // **************************************************************************
    _onOpen(): void {

        this._handlers();

    }

    // **************************************************************************
    // Действия при закрытии формы
    // **************************************************************************
    _onBeforeClose(): void {

        // Удаляем экземпляр формы
        StickerPakEdit.instance = null;

    }

    // **************************************************************************
    // Шаблон формы
    // **************************************************************************
    _template(): HTMLElement {

        // invariant: корневой .cdm-form входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`

            <div class="cdm-form sticker-pak-edit flex flex-col gap-0 w-full h-full ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center justify-between ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.circle({ intent: "transparent", attributes: ["action-close"], icon: "ArrowLeft" })}
                    ${Buttons.circle({ intent: "transparent", attributes: ["action-save"], icon: "device-floppy" })}
                </div>
                 <div class="content w-full flex ${CDM_FORM_CONTENT_CLASSES()}">

                    <div class="flex flex-col gap-3 p-3 max-w-[var(--form-max-content-width)] m-auto w-full">

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("label", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.sticker_pak_edit.name}
                            </span>
                            ${Inputs.create({ placeholder: window._lc.forms.sticker_pak_edit.name, name: "name" })}

                            ${Toggle.switch({
                                name: "is-public", checked: false,
                                toggleText: {
                                    on: window._lc.forms.sticker_pak_edit.public_on,
                                    off: window._lc.forms.sticker_pak_edit.public_off
                                }
                            })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("info-square-rounded", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${window._lc.forms.sticker_pak_edit.about}
                            </span>
                            ${Inputs.textarea({ placeholder: window._lc.forms.sticker_pak_edit.about, name: "about", rows: 4 })}
                        </div>

                    </div>

                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form")!;

    }

}
