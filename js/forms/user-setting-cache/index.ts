// Импортируем сторонние пакеты
import { OverlayScrollbars } from "overlayscrollbars";

// Импортируем config
import { CDM_FORM_CLASSES, CDM_FORM_HEADER_CLASSES, CDM_FORM_CONTENT_CLASSES, CDM_FORM_SECTION_CLASSES } from "../../config/constants.js";

// Импортируем utils
import { Logger } from "../../utils/logs/logger.js";
import { Icons } from "../../utils/icons.js";
import { LocalStorage } from "../../utils/local_storage.js"; // Понадобится для получения sessionId

// Импортируем components
import { Overlay } from "../../components/overlay/index.js";
import { Buttons } from "../../components/buttons.js";

// Импортируем handlers
import { updateAppHandler } from "./handlers/update_app.js";

// Импортируем functions
import { loadStats } from "./functions/load_stats.js";
import { clearCache } from "./functions/clear_cache.js";
import { clearDatabase } from "./functions/clear_database.js";
import { clearDatabaseTable } from "./functions/clear_database_table.js";

// Импортируем forms
import { UserProfile } from "../user-profile/index.js";
import { t } from "../../utils/i18n/index.js";

/**
 * Настройки формы кеша.
 */
export interface UserSettingCacheOptions {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

}

/**
 * Данные конструктора формы.
 */
export interface UserSettingCacheData {

    /** Id пользователя. */
    userId: string;

    /** Настройки формы. */
    options?: UserSettingCacheOptions;

}

/**
 * ***************************************************************************
 * UserSettingCache - Форма для управления кешем и локальной БД пользователя.
 * ***************************************************************************
 */
export class UserSettingCache {

    // Переменная для хранения единственного экземпляра формы
    static instance: UserSettingCache | null = null;

    /** Настройки формы. */
    options: UserSettingCacheOptions;

    /** Id пользователя. */
    userId: string;

    /** Id текущей сессии (для имён кешей). */
    sessionId: string | null;

    /** Шаблон формы. */
    tpl: HTMLElement | null = null;

    /** Модальное окно формы. */
    modal: Overlay | null = null;

    /** Контент формы (скролл-контейнер OverlayScrollbars). */
    content: HTMLElement | null = null;

    /** Инстанс OverlayScrollbars списка. */
    osListScrollInstance: OverlayScrollbars | null = null;

    /**
     * ***************************************************************************
     * Конструктор формы.
     * @param data - Данные.
     * @param data.userId - Id пользователя.
     * @param data.options - Настройки формы.
     * @param data.options.insertInto - Куда вставить форму.
     * ***************************************************************************
     */
    constructor(data: UserSettingCacheData) {

        // Если не передан userId
        if (!data?.userId) throw new Error("Не передан: userId");

        // Поиск открытого профиля пользователя
        let userProfileForm = UserProfile.instances.get(data.userId);
        let insertInto = userProfileForm?.modal?.content || null;

        // Устанавливаем настройки
        this.options = {
            insertInto,
            ...data?.options
        }

        // Переменные формы
        this.userId = data.userId;
        this.sessionId = LocalStorage.sessionId;

        // Проверяем, существует ли уже экземпляр
        if (UserSettingCache.instance) {
            return UserSettingCache.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        UserSettingCache.instance = this;

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
                url: `?user-setting-cache=${this.userId}`,
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
            Logger.error("[app][UserSettingCache]: Ошибка при открытии формы", error);
        }

    }

    // ***************************************************************************
    // Форма открылась
    // ***************************************************************************
    _onOpen(): void {

        this._handlers();

        // Загрузка статистики хранилища
        loadStats(this);

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

            // Инициализируем скроллбар (скролл-контейнер входит в шаблон)
            const content = this.content;
            if (content) {
                this.osListScrollInstance = OverlayScrollbars(content, {
                    scrollbars: { autoHide: "scroll" },
                    overflow: { x: "hidden", y: "scroll" }
                });
            }

        } catch (error) {
            Logger.error("[app][UserSettingCache]: Ошибка beforeOpen", error);
        }

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Удаляем экземпляр формы
        UserSettingCache.instance = null;

    }

    // ***************************************************************************
    // Обработчики событий
    // ***************************************************************************
    _handlers(): void {

        try {

            // Обработчики вешаются на узлы шаблона — без него нечего слушать
            if (!this.tpl) return;

            // Кнопка закрытия
            let close = this.tpl.querySelector(`:scope >.header [action-close]`);
            close?.addEventListener("click", () => this.modal?.close());

            // Обновить приложение
            let updateApp = this.tpl.querySelector(`:scope >.content [action-update-app]`);
            updateApp?.addEventListener("click", () => updateAppHandler(this));

            // Делегирование событий для кнопок очистки
            this.content?.addEventListener("click", async (e) => {

                // invariant: слушатель висит на content (Element) — цель клика элемент
                const target = e.target as Element;

                // Очистка кеша
                const btnCache = target.closest<HTMLButtonElement>("[action-clear-cache]");
                if (btnCache) {
                    const type = btnCache.getAttribute("action-clear-cache");
                    btnCache.disabled = true;
                    // Значение пишется в атрибут при сборке шаблона — без него
                    // вызывать очистку нечего
                    if (type != null) await clearCache(this, type);
                }

                // Очистка БД (все таблицы)
                const btnDb = target.closest<HTMLButtonElement>("[action-clear-db]");
                if (btnDb) {
                    btnDb.disabled = true;
                    await clearDatabase(this);
                }

                // Очистка конкретной таблицы БД
                const btnTable = target.closest<HTMLButtonElement>("[action-clear-table]");
                if (btnTable) {
                    const tableName = btnTable.getAttribute("action-clear-table");
                    btnTable.disabled = true;
                    // Имя таблицы пишется в атрибут при сборке шаблона — без
                    // него вызывать очистку нечего
                    if (tableName != null) await clearDatabaseTable(this, tableName);
                }

            });

        } catch (error) {
            Logger.error("[app][UserSettingCache]: Ошибка установки обработчиков", error);
        }

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement {

        return new DOMParser().parseFromString(`

            <div class="cdm-form user-setting-cache flex flex-col gap-0 w-full ${CDM_FORM_CLASSES()}">
                <div class="header flex flex-row gap-2 p-2 items-center ${CDM_FORM_HEADER_CLASSES()}">
                    ${Buttons.circle({ intent: "transparent", attributes: ["action-close"], icon: "ArrowLeft" })}
                    <span class="flex flex-row gap-2 items-center font-semibold text-lg ml-xs">${t("forms.user_setting_cache.title")}</span>
                </div>
                 <div class="content w-full h-full flex relative h-full ${CDM_FORM_CONTENT_CLASSES()}">

                    <div class="flex flex-col gap-4 w-full p-4 max-w-[var(--form-max-content-width)] m-auto">

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <span class="flex flex-row gap-2 items-center font-semibold">
                                <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                    ${Icons.icon("layout-grid", { settings: { size: 20 } })?.outerHTML ?? ""}
                                </span>
                                ${t("forms.user_setting_cache.app_storage")}
                            </span>
                            <div id="storage-quota-content" class="flex flex-col gap-1">
                                <div class="flex justify-center py-2">${t("forms.user_setting_cache.calculate_quota")}</div>
                            </div>
                            ${Buttons.primary({
            shape: "square",
            attributes: ["action-update-app"],
            classes: ["w-full"],
            text: t("forms.user_setting_cache.update_app")
        })}
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <div class="flex flex-row justify-between items-center border-b border-[var(--border-color)] pb-3">
                                <span class="flex flex-row gap-2 items-center font-semibold">
                                    <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                        ${Icons.icon("device-sd-card", { settings: { size: 20 } })?.outerHTML ?? ""}
                                    </span>
                                    ${t("forms.user_setting_cache.media_cache")}
                                </span>
                                ${Buttons.transparent({
            shape: "square",
            attributes: [`action-clear-cache=all`],
            text: t("forms.user_setting_cache.clear_cache")
        })}
                            </div>
                            <div id="cache-stats" class="flex flex-col gap-3 mt-1">
                                <div class="flex justify-center py-2">${t("forms.user_setting_cache.analize_cache_files")}</div>
                            </div>
                        </div>

                        <div class="flex flex-col gap-3 ${CDM_FORM_SECTION_CLASSES()}">
                            <div class="flex flex-row justify-between items-center border-b border-[var(--border-color)] pb-3">
                                <span class="flex flex-row gap-2 items-center font-semibold">
                                    <span class="flex items-center justify-center w-8 h-8 shrink-0 rounded-lg bg-[var(--color-brand)]/10 text-[var(--color-brand)]">
                                        ${Icons.icon("database", { settings: { size: 20 } })?.outerHTML ?? ""}
                                    </span>
                                    ${t("forms.user_setting_cache.local_db")}
                                </span>
                                ${Buttons.transparent({
            shape: "square",
            attributes: ["action-clear-db"],
            text: t("forms.user_setting_cache.clear_db")
        })}
                            </div>
                            <div id="db-stats" class="flex flex-col gap-3 mt-1">
                                <div class="flex justify-center py-2">${t("forms.user_setting_cache.analize_tables")}</div>
                            </div>
                        </div>

                    </div>

                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-form")!;

    }
}
