// Импортируем config
import { CDM_MODAL_CLASSES, CDM_MODAL_CONTENT_CLASSES, CDM_MODAL_FOOTER_CLASSES, CDM_MODAL_HEADER_CLASSES } from "../../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { Icons } from "../../../../utils/icons.js";

// Импортируем components
import { Overlay } from "../../../../components/overlay/index.js";
import { Buttons } from "../../../../components/buttons.js";

// Импортируем requests
import { getShareLinksRequest } from "../../requests/get_share_links.js";

// Импортируем handlers
import { revokeHandler } from "./handlers/revoke.js";

// Импортируем functions
import { fullLink } from "../../functions/full_link.js";

// Импортируем типы
import type { Cloud } from "../../index.js";
import type { CloudItem, CloudShareLinkRow } from "../../types.js";

/**
 * Настройки диалога списка ссылок.
 */
export interface ShareLinksOptions {

    /** Куда вставить диалог. */
    insertInto?: HTMLElement;

}

/**
 * Данные конструктора диалога.
 */
export interface ShareLinksData {

    /** Экземпляр формы облака. */
    form: Cloud;

    /** Папка или файл, для которого показать ссылки. */
    item: CloudItem;

    /** Настройки диалога. */
    options?: ShareLinksOptions;

}

// Form
export class ShareLinks {

    // Переменная для хранения единственного экземпляра формы
    static instance: ShareLinks | null = null;

    /**
     * ***************************************************************************
     * Форма управления ссылками-приглашениями.
     * @param data - Данные.
     * @param data.form - Экземпляр формы облака.
     * @param data.item - Папка или файл, для которого показать ссылки.
     * @param data.options - Настройки формы.
     * ***************************************************************************
     */
    constructor(data: ShareLinksData) {

        // Если не передан form или item
        if (!data?.form) throw new Error("Не передан: form");
        if (!data?.item) throw new Error("Не передан: item");

        // Устанавливаем настройки
        this.options = {
            insertInto: document.body,
            ...data?.options
        }

        // Переменные формы
        this.tpl = null;
        this.modal = null;

        // Переменные формы
        this.form = data.form;
        this.item = data.item;
        this.list = null;
        this.empty = null;

        // Проверяем, существует ли уже экземпляр
        if (ShareLinks.instance) {
            return ShareLinks.instance;
        }

        // Регистрируем диалог в форме для обновления после отзыва ссылки
        data.form.shareLinksDialog = this;

        // Сохраняем ссылку на текущий экземпляр
        ShareLinks.instance = this;

        // Инициализация
        this._init();

    }

    // Настройки формы
    options: ShareLinksOptions;

    // Каркас: шаблон и модалка
    tpl: HTMLElement | null = null;
    modal: Overlay | null = null;

    // Экземпляр формы облака и элемент, на который ссылки
    form: Cloud;
    item: CloudItem;

    // Элементы списка ссылок
    list: HTMLElement | null = null;
    empty: HTMLElement | null = null;

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
            let close = this.tpl.querySelectorAll(":scope [action-close]");
            close?.forEach(btn => btn.addEventListener("click", () => this.modal?.close()));

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Форма открылась
    // ***************************************************************************
    _onOpen(): void {

        // Элементы задаются шаблоном — без него нечего настраивать
        if (!this.tpl) return;

        // Устанавливаем элементы списка
        this.list = this.tpl.querySelector(":scope [data-list]");
        this.empty = this.tpl.querySelector(":scope [data-empty]");

        // Устанавливаем обработчики
        this._handlers();

        // Загружаем список ссылок элемента
        this._loadLinks();

    }

    // ***************************************************************************
    // Загрузка списка ссылок элемента
    // ***************************************************************************
    async _loadLinks(): Promise<void> {

        try {

            // Список задаётся в _onOpen — без него нечего заполнять
            const list = this.list;
            if (!list) return;

            // Запрос на сервер
            let response = await getShareLinksRequest({ item_id: this.item.id });

            // Если ответ успешный
            if (response.status && response.data) {

                // Очищаем список
                list.innerHTML = "";

                // Получаем ссылки
                let links = response.data || [];

                // Показываем или скрываем пустое состояние
                this.empty?.classList.toggle("hidden", links.length > 0);

                // Создаем строки ссылок
                links.forEach(link => {
                    list.appendChild(this._createLinkRow(link));
                });

            }

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Создание строки ссылки
    // @param link - Данные ссылки.
    // @returns Элемент строки.
    // ***************************************************************************
    _createLinkRow(link: CloudShareLinkRow): HTMLElement {

        // invariant: корневой .item входит в сам шаблон строки — querySelector
        // с текстовым HTML всегда находит его
        let row = new DOMParser().parseFromString(`
            <div class="item flex flex-row gap-2 p-2 py-1 items-center bg-[var(--second-bg)] rounded-md">
                <div class="flex items-center justify-center shrink-0 w-8 h-8 bg-[var(--color-brand)]/10 text-[var(--color-brand)] rounded-lg">${Icons.icon("Link")?.outerHTML ?? ""}</div>
                <div class="flex flex-col gap-0 min-w-0 flex-1">
                    <span data-link class="text-sm font-mono truncate"></span>
                    <span data-meta class="text-xs text-muted truncate"></span>
                </div>
                <span data-access class="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-md bg-[var(--color-brand)]/10 text-[var(--color-brand)]"></span>
                ${Buttons.transparent({ shape: "circle", attributes: ["action-copy"], icon: "copy" })}
                ${Buttons.transparent({ shape: "circle", attributes: ["action-revoke"], icon: "trash" })}
            </div>
        `, "text/html").querySelector<HTMLElement>(".item")!;

        // Заполняем данные строки
        let linkEl = row.querySelector("[data-link]");
        let metaEl = row.querySelector("[data-meta]");
        let accessEl = row.querySelector("[data-access]");

        // Значение ссылки (полный адрес с доменом)
        if (linkEl) linkEl.textContent = fullLink(link.link);

        // Метаданные (дата создания и срок действия)
        if (metaEl) {
            metaEl.textContent = _formatMeta(link);
        }

        // Уровень доступа
        if (accessEl) {
            accessEl.textContent = link.access_level === "write"
                ? window._lc.forms.cloud.badges.write
                : window._lc.forms.cloud.badges.read;
        }

        // Копировать
        row.querySelector("[action-copy]")?.addEventListener("click", async (event) => {
            event.stopPropagation();
            try {
                await navigator.clipboard.writeText(fullLink(link.link));
            } catch (error) {
                Logger.error(error);
            }
        });

        // Отозвать ссылку
        row.querySelector("[action-revoke]")?.addEventListener("click", (event) => {
            event.stopPropagation();
            revokeHandler(this, link);
        });

        return row;

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Удаляем ссылку на диалог из формы
        if (this.form.shareLinksDialog === this) {
            this.form.shareLinksDialog = null;
        }

        // Удаляем экземпляр формы
        ShareLinks.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`

            <div class="cdm-modal cloud-share-links flex flex-col p-0 gap-0 w-[26rem] ${CDM_MODAL_CLASSES()}">
                <div class="${CDM_MODAL_HEADER_CLASSES()}">
                    <span class="flex flex-row gap-2 items-center font-semibold text-lg truncate">${window._lc.forms.cloud.dialogs.share_links.title}</span>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "x" })}
                </div>
                 <div class="${CDM_MODAL_CONTENT_CLASSES()} max-h-[26rem]">
                    <span class="text-secondary text-sm truncate">${window._lc.forms.cloud.dialogs.share_links.item}: ${this.item?.name || ""}</span>
                    <div class="flex flex-col gap-1">
                        <div data-empty class="flex flex-col gap-1 items-center text-center text-muted text-sm p-4">
                            ${Icons.icon("link")?.outerHTML ?? ""}
                            <span>${window._lc.forms.cloud.dialogs.share_links.empty}</span>
                        </div>
                        <div data-list class="flex flex-col gap-1"></div>
                    </div>
                </div>
                <div class="${CDM_MODAL_FOOTER_CLASSES()}">
                    ${Buttons.primary({ attributes: ["action-close"], classes: ["w-full"], text: window._lc.forms.cloud.dialogs.share_links.action_close })}
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-modal");

    }

}

/**
 * ***************************************************************************
 * Формирование строки метаданных ссылки: создана / срок действия.
 * @param link - Данные ссылки.
 * @returns Строка метаданных.
 * ***************************************************************************
 */
function _formatMeta(link: CloudShareLinkRow): string {

    // Части строки
    let parts: string[] = [];

    // Дата создания
    if (link.created_at) {
        let date = new Date(link.created_at);
        parts.push(`${window._lc.forms.cloud.dates.created} ${date.toLocaleDateString()}`);
    }

    // Дата истечения
    if (link.expires_at) {
        let date = new Date(link.expires_at);
        parts.push(`${window._lc.forms.cloud.dates.until} ${date.toLocaleDateString()}`);
    }

    // Склеиваем части
    return parts.join(" · ");

}
