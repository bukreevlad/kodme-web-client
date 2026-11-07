// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_SECTION_CLASSES, CDM_MODAL_CLASSES, CDM_MODAL_FOOTER_CLASSES, CDM_MODAL_HEADER_CLASSES, CDM_MODAL_CONTENT_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Avatars, AvatarImageDocument } from "../../components/avatars.js";
import { Buttons } from "../../components/buttons.js";

// Импортируем handlers
import { openHandler } from "./handlers/open.js";

/**
 * Настройки формы приглашения в канал.
 */
export interface InviteChannelOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные формы приглашения в канал (метаданные приглашения + ссылка).
 */
export interface InviteChannelData {

    /** Настройки формы. */
    options?: InviteChannelOptions;

    /** Ссылка-приглашение. */
    invite?: string;

    /** Id канала. */
    channel_id: string;

    /** Тип канала (число из БД: 2 — группа, 3 — канал). */
    channel_type?: string | number;

    /** Отображаемое имя канала. */
    display_name?: string;

    /** Описание канала. */
    about?: string;

    /** Число участников канала. */
    total_members?: number;

    /** Аватар канала (документ файла storage). */
    avatar?: unknown;

}

/**
 * Входные данные формы: channel_id может отсутствовать — например, в ответе
 * сервера о приглашении, где заполнено поле только для своего типа сущности.
 * Без channel_id конструктор бросает ошибку, форма не открывается.
 */
export type InviteChannelInput = Omit<InviteChannelData, "channel_id"> & {

    /** Id канала (отсутствует для приглашений других типов сущностей). */
    channel_id?: string;

};

/**
 * ***************************************************************************
 * Guard: похож ли аватар приглашения на документ файла storage.
 * Аватар приходит с сервера как unknown — Avatars принимает только
 * документ {id, token, metadata}, строка или повреждённый объект не даёт
 * изображения и заменяется null (акроним по имени).
 * @param value - Проверяемое значение.
 * @returns Да, если значение похоже на документ файла.
 ***************************************************************************
 */
function isAvatarImageDocument(value: unknown): value is AvatarImageDocument {
    return typeof value === "object" && value !== null && "id" in value;
}

// Form
export class InviteChannel {

    // Переменная для хранения единственного экземпляра формы
    static instance: InviteChannel | null = null;

    /** Настройки формы. */
    options: InviteChannelOptions;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Контент формы (скролл-контейнер OverlayScrollbars). */
    content: HTMLElement | null = null;

    /** Инстанс OverlayScrollbars контента. */
    osListScrollInstance: OverlayScrollbars | null = null;

    /** Метаданные приглашения (канал + ссылка). */
    invite: InviteChannelData;

    /**
     * ***************************************************************************
     * Форма.
     * @param data - Данные.
     * ***************************************************************************
     */
    constructor(data: InviteChannelInput) {

        // Если не передан channel_id
        if (!data?.channel_id) throw new Error("Не передан: channel_id");

        // Устанавливаем настройки
        this.options = {
            ...data?.options
        }

        // Переменные формы (channel_id проверен guard'ом выше — копируем
        // данные с уже суженным полем)
        this.invite = { ...data, channel_id: data.channel_id };

        // Проверяем, существует ли уже экземпляр
        if (InviteChannel.instance) {
            return InviteChannel.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        InviteChannel.instance = this;

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

            if (!this.tpl) return;

            // Форма
            this.modal = new Overlay(this.tpl, {
                type: "modal",
                url: `?channel-invite=${this.invite.channel_id}`,
                insertInto: this.options.insertInto,
                closeOnEsc: true,
                closeOnOverlay: true,
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
    _handlers(): void {

        try {

            // Обработчики вешаются на узлы шаблона — без него нечего слушать
            if (!this.tpl) return;

            // Закрыть
            let close = this.tpl.querySelector(":scope >.footer [action-close]");
            close?.addEventListener("click", () => this.modal?.close());

            // Открыть
            let open = this.tpl.querySelector(":scope >.footer >[action-open]");
            open?.addEventListener("click", () => openHandler(this));

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
            this.content = this.tpl.querySelector(":scope >.content");
            let avatar = this.tpl.querySelector<HTMLElement>(":scope >.content .cdm-avatar");
            let name = this.tpl.querySelector<HTMLElement>(":scope >.content [data-name]");
            let channelType = this.tpl.querySelector<HTMLElement>(":scope >.content [data-channel-type]");
            let about = this.tpl.querySelector<HTMLElement>(":scope >.content [data-about]");
            let totalMembers = this.tpl.querySelector<HTMLElement>(":scope >.content [data-total-members]");

            // Аватар
            new Avatars({
                element: avatar,
                id: this.invite.channel_id,
                name: this.invite.display_name,
                image: isAvatarImageDocument(this.invite.avatar) ? this.invite.avatar : null,
                size: "3xl"
            });

            // Записываем данные
            if (name) name.textContent = this.invite.display_name || "";
            if (about) about.textContent = this.invite.about || "";
            if (totalMembers) totalMembers.textContent = `${window._lc.forms.invite_channel.members}: ${this.invite.total_members}`;
            if (channelType) channelType.textContent = this.invite.channel_type === 3 ? window._lc.forms.invite_channel.channel : window._lc.forms.invite_channel.group;

            // Инициализируем элементы
            if (this.content) {
                this.osListScrollInstance = OverlayScrollbars(this.content, {
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
    _onOpen(): void {

        this._handlers();

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Удаляем экземпляр формы
        InviteChannel.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        // invariant: корневой .cdm-modal входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`
        
            <div class="cdm-modal invite-channel flex flex-col gap-0 ${CDM_MODAL_CLASSES()}">
                 <div class="${CDM_MODAL_HEADER_CLASSES()}">
                    <span class="font-semibold text-lg">${window._lc.forms.invite_channel.title}</span>
                </div>
                 <div class="${CDM_MODAL_CONTENT_CLASSES()}">

                    <div class="flex flex-col gap-2 items-center w-full">

                        <div class="flex flex-col gap-2.5 items-center ${CDM_FORM_SECTION_CLASSES()} p-4 w-full">

                            <div class="cdm-avatar relative"></div>
                            <div class="flex flex-col gap-0 items-center">
                                <span data-name class="font-semibold"></span>
                                <span data-channel-type class="text-[var(--color-brand)] dark:text-[var(--color-brand)] text-sm"></span>
                                <span data-about class="empty:hidden text-secondary text-sm"></span>
                                <span data-total-members class="empty:hidden text-muted text-sm"></span>
                            </div>

                        </div>

                    </div>

                </div>
                <div class="${CDM_MODAL_FOOTER_CLASSES()}">
                    ${Buttons.create({ attributes: ["action-close"], classes: ["w-full"], text: window._lc.forms.invite_channel.cancel })}
                    ${Buttons.primary({ attributes: ["action-open"], classes: ["w-full"], text: window._lc.forms.invite_channel.open })}
                </div>
            </div>

        `, "text/html").querySelector(".cdm-modal");

    }

}
