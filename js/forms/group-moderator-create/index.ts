// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES, CDM_FORM_SECTION_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Icons } from "../../utils/icons.js";

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Avatars } from "../../components/avatars.js";
import { Buttons } from "../../components/buttons.js";
import { Toggle } from "../../components/toggle.js";

// Импортируем forms
import { GroupModeratorsManager } from "../group-moderators-manager/index.js";

// Импортируем handlers
import { addModeratorHandler } from "./handlers/add.js";

// Импортируем типы
import type { AvatarImageDocument } from "../../components/avatars.js";

/**
 * Пользователь, выбранный в поиске и переданный в диалог добавления
 * модератора. Поля — только те, что читает диалог (строка результата
 * поиска шире).
 */
export interface GroupAddModeratorUser {

    /** Id пользователя. */
    id: string;

    /** Отображаемое имя. */
    display_name?: string;

    /** Ссылка профиля (@username). */
    link?: string | null;

    /** Описание профиля. */
    bio?: string | null;

    /** Документ изображения аватара. */
    avatar?: AvatarImageDocument | null;

}

/**
 * Настройки диалога добавления модератора.
 */
export interface GroupAddModeratorOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные диалога добавления модератора.
 */
export interface GroupAddModeratorData {

    /** Выбранный пользователь. */
    user: GroupAddModeratorUser;

    /** Id канала (группы). */
    channelId: string;

    /** Настройки формы. */
    options?: GroupAddModeratorOptions;

}

// Form
export class GroupAddModerator {

    // Переменная для хранения единственного экземпляра формы
    static instance: GroupAddModerator | null = null;

    /**
     * ***************************************************************************
     * Диалог добавления модератора в группу.
     * @param data - Данные.
     * @param data.user - Выбранный пользователь.
     * @param data.channelId - ID канала.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: GroupAddModeratorData) {

        // Поиск открытого менеджера модераторов: форма добавления
        // открывается внутри него. Если менеджер закрыт — левая колонка home
        const insertInto: HTMLElement | null = GroupModeratorsManager.instances.get(data.channelId)?.modal?.content
            || document.querySelector(".cdm-form.home .left");

        // Устанавливаем настройки
        this.options = {
            insertInto,
            ...data?.options
        }

        // Переменные формы
        this.tpl = null;
        this.modal = null;
        this.content = null;
        this.osListScrollInstance = null;

        // Переменные формы
        this.user = data.user;
        this.channelId = data.channelId;

        // Проверяем, существует ли уже экземпляр
        if (GroupAddModerator.instance) {
            return GroupAddModerator.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        GroupAddModerator.instance = this;

        // Инициализация
        this._init();

    }

    // Каркас: шаблон, модалка, контент и скроллбар
    tpl: HTMLElement | null;
    modal: Overlay | null;
    content: HTMLElement | null;
    osListScrollInstance: OverlayScrollbars | null;

    // Данные диалога
    user: GroupAddModeratorUser;
    channelId: string;

    // Настройки формы
    options: GroupAddModeratorOptions;

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

            // Добавить
            let add = this.tpl.querySelector(":scope >.header [action-add]");
            add?.addEventListener("click", () => addModeratorHandler(this));

            // Закрыть
            let cancel = this.tpl.querySelector(":scope >.header [action-close]");
            cancel?.addEventListener("click", () => this.modal?.close());

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
            let link = this.tpl.querySelector<HTMLElement>(":scope >.content [data-link]");
            let bio = this.tpl.querySelector<HTMLElement>(":scope >.content [data-bio]");

            // Поля обязаны входить в шаблон — иначе заполнять нечего
            if (!name || !link || !bio) return;

            // Аватар
            new Avatars({
                element: avatar,
                id: this.user.id,
                name: this.user.display_name,
                image: this.user.avatar,
                size: "3xl"
            });

            // Записываем данные (поля профиля опциональны — нормализуем,
            // чтобы в поле не «утекало» undefined/null)
            name.textContent = this.user.display_name ?? null;
            link.textContent = this.user.link ?? null;
            bio.textContent = this.user.bio ?? null;

            // Инициализируем скроллбар
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
    async _onOpen(): Promise<void> {

        this._handlers();

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Удаляем экземпляр формы
        GroupAddModerator.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`
        
            <div class="cdm-form group-add-moderator flex flex-col gap-0 ${CDM_FORM_CLASSES()} w-full">
                <div class="header flex flex-row gap-2 p-2 items-center ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "ArrowLeft" })}
                    <span class="flex-1 font-semibold text-base truncate">${window._lc.forms.group_moderator_add.title}</span>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-add"], icon: "device-floppy" })}
                </div>
                 <div class="content w-full h-full flex ${CDM_FORM_CONTENT_CLASSES()}">

                    <div class="flex flex-col gap-3 p-3 max-w-[var(--form-max-content-width)] m-auto w-full">

                        <div class="flex flex-col gap-3 items-center ${CDM_FORM_SECTION_CLASSES()}">
                            <div class="cdm-avatar relative"></div>
                            <div class="flex flex-col gap-1 items-center">
                                <span data-name class="font-semibold"></span>
                                <span data-link class="empty:hidden text-[var(--color-brand)] dark:text-[var(--color-brand)] font-mono"></span>
                                <span data-bio class="empty:hidden text-muted text-center font-mono text-sm"></span>
                            </div>
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <div class="flex flex-col gap-1">
                                <span class="flex flex-row gap-2 items-center font-semibold">
                                    <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                        ${Icons.icon("trash", { settings: { size: 20 } })?.outerHTML ?? ""}
                                    </span>
                                    ${window._lc.forms.group_moderator_add.remove_post}
                                </span>
                                <span class="text-sm text-secondary">${window._lc.forms.group_moderator_add.remove_post_desc}</span>
                            </div>
                            ${Toggle.switch({
                                name: "can-deleted-message",
                                checked: false,
                                toggleText: {
                                    on: window._lc.forms.group_moderator_add.enabled,
                                    off: window._lc.forms.group_moderator_add.disabled
                                }
                            })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <div class="flex flex-col gap-1">
                                <span class="flex flex-row gap-2 items-center font-semibold">
                                    <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                        ${Icons.icon("message-off", { settings: { size: 20 } })?.outerHTML ?? ""}
                                    </span>
                                    ${window._lc.forms.group_moderator_add.user_all_post_remove}
                                </span>
                                <span class="text-sm text-secondary">${window._lc.forms.group_moderator_add.user_all_post_remove_desc}</span>
                            </div>
                            ${Toggle.switch({
                                name: "can-clean-messages",
                                checked: false,
                                toggleText: {
                                    on: window._lc.forms.group_moderator_add.enabled,
                                    off: window._lc.forms.group_moderator_add.disabled
                                }
                            })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <div class="flex flex-col gap-1">
                                <span class="flex flex-row gap-2 items-center font-semibold">
                                    <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                        ${Icons.icon("ban", { settings: { size: 20 } })?.outerHTML ?? ""}
                                    </span>
                                    ${window._lc.forms.group_moderator_add.block_user}
                                </span>
                                <span class="text-sm text-secondary">${window._lc.forms.group_moderator_add.block_user_desc}</span>
                            </div>
                            ${Toggle.switch({
                                name: "can-restrict-members",
                                checked: false,
                                toggleText: {
                                    on: window._lc.forms.group_moderator_add.enabled,
                                    off: window._lc.forms.group_moderator_add.disabled
                                }
                            })}
                        </div>

                    </div>

                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form");

    }

}
