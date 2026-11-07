// Импортируем config
import { CDM_MODAL_CLASSES, CDM_MODAL_FOOTER_CLASSES, CDM_MODAL_HEADER_CLASSES } from "../../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { Icons } from "../../../../utils/icons.js";
import { formatBytes } from "../../../../utils/string/format_bytes.js";

// Импортируем components
import { Overlay } from "../../../../components/overlay/index.js";
import { Buttons } from "../../../../components/buttons.js";

// Импортируем requests
import { openShareLinkRequest } from "../../requests/open_share_link.js";

// Импортируем handlers
import { downloadFileHandler } from "../../handlers/download_file.js";
import type { DownloadFileData } from "../../handlers/download_file.js";

// Импортируем functions
import { getFileIcon } from "../../functions/file_icon.js";

// Импортируем типы
import type { CloudFilePayload, CloudSharedItem, CloudSharedOwner } from "../../types.js";
import { t } from "../../../../utils/i18n/index.js";

/**
 * Настройки окна информации о файле.
 */
export interface CloudFileInfoOptions {

    /** Куда вставить окно. */
    insertInto?: HTMLElement;

}

/**
 * Данные конструктора окна.
 */
export interface CloudFileInfoData {

    /** Значение ссылки (иначе — готовые данные файла). */
    link?: string;

    /** Элемент облака (если данные уже получены). */
    item?: CloudSharedItem | null;

    /** Данные файла из «open share link» (если получены). */
    file?: CloudFilePayload | null;

    /** Владелец элемента. */
    owner?: CloudSharedOwner | null;

    /** Настройки формы. */
    options?: CloudFileInfoOptions;

}

// Form
export class CloudFileInfo {

    // Переменная для хранения единственного экземпляра формы
    static instance: CloudFileInfo | null = null;

    /**
     * ***************************************************************************
     * Окно с информацией о файле по ссылке общего доступа.
     * @param data - Данные.
     * @param data.link - Значение ссылки (иначе — готовые данные файла).
     * @param data.item - Элемент облака (если данные уже получены).
     * @param data.file - Данные файла из «open share link» (если получены).
     * @param data.owner - Владелец элемента.
     * @param data.options - Настройки формы.
     * ***************************************************************************
     */
    constructor(data: CloudFileInfoData) {

        // Если не передан link и нет готовых данных файла
        if (!data?.link && !data?.file) throw new Error("Не передан: link или file");

        // Устанавливаем настройки
        this.options = {
            insertInto: document.body,
            ...data?.options
        }

        // Переменные формы
        this.tpl = null;
        this.modal = null;

        // Переменные формы
        this.link = data.link;
        this.item = data.item || null;
        this.file = data.file || null;
        this.owner = data.owner || null;

        // Проверяем, существует ли уже экземпляр
        if (CloudFileInfo.instance) {
            return CloudFileInfo.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        CloudFileInfo.instance = this;

        // Инициализация
        this._init();

    }

    // Настройки формы
    options: CloudFileInfoOptions;

    // Каркас: шаблон и модалка
    tpl: HTMLElement | null = null;
    modal: Overlay | null = null;

    // Данные файла: ссылка, элемент, файл и владелец
    link?: string | undefined;
    item: CloudSharedItem | null;
    file: CloudFilePayload | null;
    owner: CloudSharedOwner | null;

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
            this.tpl.querySelectorAll("[action-close]").forEach(btn => {
                btn?.addEventListener("click", () => this.modal?.close());
            });

            // Скачать файл
            let download = this.tpl.querySelector(":scope [action-download]");
            download?.addEventListener("click", async () => await this._download());

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Форма открылась
    // ***************************************************************************
    async _onOpen(): Promise<void> {

        // Устанавливаем обработчики
        this._handlers();

        // Загружаем данные файла по ссылке
        await this._load();

    }

    // ***************************************************************************
    // Загрузка данных файла (если не переданы готовые)
    // ***************************************************************************
    async _load(): Promise<void> {

        try {

            // Если данные файла уже переданы — просто отображаем
            if (this.file) {
                this._render();
                return;
            }

            // Запрос данных по ссылке
            let response = await openShareLinkRequest({ link: this.link });

            // Если ответ успешный и это файл
            if (response?.status && response.data?.item?.item_type === "file") {
                this.item = response.data.item;
                this.file = response.data.file || null;
                this.owner = response.data.owner || null;
                this._render();
            } else {
                this.modal?.close();
            }

        } catch (error) {
            Logger.error(error);
            this.modal?.close();
        }

    }

    // ***************************************************************************
    // Отображение информации о файле
    // ***************************************************************************
    _render(): void {

        try {

            // Элементы задаются шаблоном — без него нечего отображать
            if (!this.tpl) return;

            // Элементы
            let iconWrap = this.tpl.querySelector("[data-icon]");
            let name = this.tpl.querySelector("[data-name]");
            let meta = this.tpl.querySelector("[data-meta]");
            let type = this.tpl.querySelector("[data-type]");

            // Иконка по типу файла
            if (iconWrap) {
                iconWrap.innerHTML = Icons.icon(getFileIcon(this.file || {}), { settings: { size: 40 } })?.outerHTML ?? "";
            }

            // Имя файла
            if (name) {
                name.textContent = this.file?.file_name || this.item?.name || "";
            }

            // Владелец и размер
            if (meta) {
                let ownerName = "";
                if (this.owner?.first_name || this.owner?.last_name) {
                    ownerName = `${this.owner.first_name || ""} ${this.owner.last_name || ""}`.trim();
                }
                let parts: string[] = [];
                if (ownerName) parts.push(ownerName);
                if (this.file?.size) parts.push(formatBytes(this.file.size));
                meta.textContent = parts.join(" · ");
            }

            // Тип файла
            if (type) {
                let ext = (this.file?.extname || "").toLowerCase().replace(/^\./, "");
                let mime = this.file?.mime_type || "";
                type.textContent = `${t("forms.cloud.dialogs.file_info.type")}: ${ext || mime || "—"}`;
            }

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Скачивание файла
    // ***************************************************************************
    async _download(): Promise<void> {

        // Без шаблона кнопку не переключить — и скачивать нечего
        const tpl = this.tpl;
        if (!tpl) return;

        try {

            // Если файла нет — выходим
            if (!this.file) return;

            // Отключаем кнопку на время скачивания
            let download = tpl.querySelector<HTMLButtonElement>("[action-download]");
            if (download) download.disabled = true;

            // Скачиваем файл (document_id — id документа для storage URL);
            // item_id пробрасывается как в легаси — обработчик его не читает
            let payload: DownloadFileData & { item_id?: string | undefined } = {
                ...this.file,
                item_id: this.item?.id,
                document_id: this.file.id
            };
            await downloadFileHandler(payload);

        } catch (error) {
            Logger.error(error);
        } finally {
            // Возвращаем кнопку в исходное состояние
            let download = tpl.querySelector<HTMLButtonElement>("[action-download]");
            if (download) download.disabled = false;
        }

    }

    // ***************************************************************************
    // Действия при закрытии формы
    // ***************************************************************************
    _onBeforeClose(): void {

        // Удаляем экземпляр формы
        CloudFileInfo.instance = null;

    }

    // ***************************************************************************
    // Шаблон формы
    // ***************************************************************************
    _template(): HTMLElement | null {

        return new DOMParser().parseFromString(`

            <div class="cdm-modal cloud-file-info flex flex-col p-0 gap-0 ${CDM_MODAL_CLASSES()}">
                <div class="${CDM_MODAL_HEADER_CLASSES()}">
                    <span class="flex flex-row gap-2 items-center font-semibold text-lg truncate">${t("forms.cloud.dialogs.file_info.title")}</span>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "x" })}
                </div>
                <div class="content w-full flex flex-col items-center p-3 gap-2.5">
                    <div data-icon class="flex items-center justify-center shrink-0 w-20 h-20 bg-[var(--color-brand)]/10 text-[var(--color-brand)] rounded-2xl">${Icons.icon("file", { settings: { size: 40 } })?.outerHTML ?? ""}</div>
                    <span data-name class="text-sm font-semibold text-center break-all"></span>
                    <div class="flex flex-col gap-1 text-xs text-muted items-center">
                        <span data-meta class="text-center"></span>
                        <span data-type class="text-center"></span>
                    </div>
                </div>
                <div class="${CDM_MODAL_FOOTER_CLASSES()}">
                    ${Buttons.primary({ attributes: ["action-download"], classes: ["w-full"], text: t("forms.cloud.dialogs.file_info.action_download") })}
                    ${Buttons.create({ attributes: ["action-close"], classes: ["w-full"], text: t("forms.cloud.dialogs.file_info.action_close") })}
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-modal");

    }

}
