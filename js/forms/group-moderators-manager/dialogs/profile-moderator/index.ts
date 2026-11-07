// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_SECTION_CLASSES, CDM_MODAL_CLASSES, CDM_MODAL_CONTENT_CLASSES } from "../../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { Icons } from "../../../../utils/icons.js";

// Импортируем components
import { Overlay } from "../../../../components/overlay/index.js";
import { Avatars } from "../../../../components/avatars.js";
import { Buttons } from "../../../../components/buttons.js";
import { Toggle } from "../../../../components/toggle.js";

// Импортируем forms
import { GroupModeratorsManager } from "../../../group-moderators-manager/index.js";

// Импортируем handlers
import { saveModeratorHandler } from "./handlers/save.js";

// Импортируем requests
import { getModeratorSettingsRequest } from "./requests/get_settings.js";

// Импортируем типы
import type { GroupModeratorRecord } from "../../types.js";
import { t } from "../../../../utils/i18n/index.js";

/**
 * Настройки диалога настроек модератора.
 */
export interface GroupProfileModeratorOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные диалога настроек модератора.
 */
export interface GroupProfileModeratorData {

    /** Id пользователя-модератора. */
    userId: string;

    /** Id канала (группы). */
    channelId: string;

    /** Настройки формы. */
    options?: GroupProfileModeratorOptions;

}

// Form
export class GroupProfileModerator {

    // Переменная для хранения единственного экземпляра формы
    static instance: GroupProfileModerator | null = null;

    /**
     * ***************************************************************************
     * Диалог настроек модератора группы: права модерации (переключатели)
     * над данными участника и пользователя.
     * @param data - Данные.
     * @param data.userId - ID пользователя-модератора.
     * @param data.channelId - ID канала.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: GroupProfileModeratorData) {

        // Поиск открытого менеджера модераторов
        let groupModeratorsManagerForm = GroupModeratorsManager.instances.get(data.channelId);
        let insertInto = groupModeratorsManagerForm?.modal?.content || null;

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
        this.userId = data.userId;
        this.channelId = data.channelId;
        this.profile = null;

        // Проверяем, существует ли уже экземпляр
        if (GroupProfileModerator.instance) {
            return GroupProfileModerator.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        GroupProfileModerator.instance = this;

        // Инициализация
        this._init();

    }

    // Каркас: шаблон, модалка, контент и скроллбар
    tpl: HTMLElement | null;
    modal: Overlay | null;
    content: HTMLElement | null;
    osListScrollInstance: OverlayScrollbars | null;

    // Данные диалога: profile заполняется ответом "[group]: get moderator settings"
    userId: string;
    channelId: string;
    profile: GroupModeratorRecord | null;

    // Настройки формы
    options: GroupProfileModeratorOptions;

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
                type: "modal",
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
            let close = this.tpl.querySelector(":scope >.footer [action-cancel]");
            close?.addEventListener("click", () => this.modal?.close());

            // Сохранить
            let save = this.tpl.querySelector(":scope >.footer [action-save]");
            save?.addEventListener("click", () => saveModeratorHandler(this));

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Настройка формы
    // ***************************************************************************
    async _onBeforeOpen(): Promise<void> {

        try {

            // Запрос на сервер
            let response = await getModeratorSettingsRequest({
                channel_id: this.channelId,
                user_id: this.userId
            });

            // Записываем данные
            this.profile = response.data;

            // Элементы заполняются из шаблона — без него нечего настраивать
            if (!this.tpl) return;

            // Устанавливаем элементы
            this.content = this.tpl.querySelector(":scope >.content");
            let avatar = this.tpl.querySelector<HTMLElement>(":scope >.content .cdm-avatar");
            let name = this.tpl.querySelector<HTMLElement>(":scope >.content [data-name]");
            let link = this.tpl.querySelector<HTMLElement>(":scope >.content [data-link]");
            let bio = this.tpl.querySelector<HTMLElement>(":scope >.content [data-bio]");

            // Устанавливаем элементы
            let canDeletedMessage = this.tpl.querySelector<HTMLElement>(`:scope >.content [name="can-deleted-message"]`);
            let canCleanMessages = this.tpl.querySelector<HTMLElement>(`:scope >.content [name="can-clean-messages"]`);
            let canRestrictMembers = this.tpl.querySelector<HTMLElement>(`:scope >.content [name="can-restrict-members"]`);

            // Поля обязаны входить в шаблон — иначе заполнять нечего
            if (!name || !link || !bio || !canDeletedMessage || !canCleanMessages || !canRestrictMembers) return;

            // Аватар
            new Avatars({
                element: avatar,
                id: this.profile.id,
                name: this.profile.display_name,
                image: this.profile.avatar,
                size: "3xl"
            });

            // Записываем данные (поля профиля опциональны — нормализуем,
            // чтобы в поле не «утекало» undefined)
            name.textContent = this.profile.display_name ?? null;
            link.textContent = this.profile.link ?? null;
            bio.textContent = this.profile.bio ?? null;

            // Включаем переключатели по правам модератора
            this.profile?.can_deleted_message && canDeletedMessage.click();
            this.profile?.can_clean_messages && canCleanMessages.click();
            this.profile?.can_restrict_members && canRestrictMembers.click();

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
        GroupProfileModerator.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`
        
            <div class="cdm-modal group-profile-moderator flex flex-col gap-0 ${CDM_MODAL_CLASSES()}">
                 <div class="${CDM_MODAL_CONTENT_CLASSES()}">

                    <div class="flex flex-col gap-3 w-full">

                        <div class="flex flex-col gap-2 p-3 items-center">
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
                                    ${t("forms.group_moderator_profile.remove_post")}
                                </span>
                                <span class="text-sm text-secondary">${t("forms.group_moderator_profile.remove_post_desc")}</span>
                            </div>
                            ${Toggle.switch({
                                name: "can-deleted-message",
                                checked: false,
                                toggleText: {
                                    on: t("forms.group_moderator_profile.enabled"),
                                    off: t("forms.group_moderator_profile.disabled")
                                }
                            })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <div class="flex flex-col gap-1">
                                <span class="flex flex-row gap-2 items-center font-semibold">
                                    <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                        ${Icons.icon("message-off", { settings: { size: 20 } })?.outerHTML ?? ""}
                                    </span>
                                    ${t("forms.group_moderator_profile.user_all_post_remove")}
                                </span>
                                <span class="text-sm text-secondary">${t("forms.group_moderator_profile.user_all_post_remove_desc")}</span>
                            </div>
                            ${Toggle.switch({
                                name: "can-clean-messages",
                                checked: false,
                                toggleText: {
                                    on: t("forms.group_moderator_profile.enabled"),
                                    off: t("forms.group_moderator_profile.disabled")
                                }
                            })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <div class="flex flex-col gap-1">
                                <span class="flex flex-row gap-2 items-center font-semibold">
                                    <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                        ${Icons.icon("ban", { settings: { size: 20 } })?.outerHTML ?? ""}
                                    </span>
                                    ${t("forms.group_moderator_profile.block_user")}
                                </span>
                                <span class="text-sm text-secondary">${t("forms.group_moderator_profile.block_user_desc")}</span>
                            </div>
                            ${Toggle.switch({
                                name: "can-restrict-members",
                                checked: false,
                                toggleText: {
                                    on: t("forms.group_moderator_profile.enabled"),
                                    off: t("forms.group_moderator_profile.disabled")
                                }
                            })}
                        </div>

                    </div>

                </div>
                
                <div class="footer p-3 flex flex-row gap-2">
                    ${Buttons.create({
                        shape: "square",
                        attributes: ["action-cancel"],
                        classes: ["w-full"],
                        text: t("forms.group_moderator_profile.close")
                    })}
                    ${Buttons.primary({
                        shape: "square",
                        attributes: ["action-save"],
                        classes: ["w-full"],
                        text: t("forms.group_moderator_profile.save")
                    })}
                </div>
                
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-modal");

    }

}
