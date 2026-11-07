// Импортируем config
import { CDM_MODAL_CLASSES, CDM_MODAL_CONTENT_CLASSES, CDM_MODAL_FOOTER_CLASSES, CDM_MODAL_HEADER_CLASSES } from "../../../config/constants.js";

// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Overlay } from "../../../components/overlay/index.js";
import { Buttons } from "../../../components/buttons.js";

/**
 * Данные диалога удаления комментария.
 */
export interface RemoveCommentDialogData {

    /** Куда вставить форму. */
    insertInto?: HTMLElement | null;

    /** Ответ диалога вызывающему коду (true — подтверждено). */
    callback?: ((confirmed: boolean) => void) | undefined;

}

/**
 * ***************************************************************************
 * RemoveComment - диалог подтверждения удаления комментария.
 *
 * Удаление комментариев всегда глобальное (у личной корзины удалённых
 * комментариев нет), поэтому чекбокс «удалить для всех» не показывается —
 * в отличие от диалога удаления сообщения.
 * ***************************************************************************
 */
export class RemoveComment {

    /** Единственный экземпляр диалога (Singleton). */
    static instance: RemoveComment | null = null;

    /** Модальное окно диалога. */
    modal: Overlay | null = null;

    /** Ответ диалога вызывающему коду. */
    callback?: ((confirmed: boolean) => void) | undefined;

    /**
     * ***************************************************************************
     * Диалог.
     * @param data - Данные (куда вставить, callback).
     * ***************************************************************************
     */
    constructor(data: RemoveCommentDialogData) {

        // Устанавливаем настройки
        this.callback = data.callback;

        // Проверяем, существует ли уже экземпляр
        if (RemoveComment.instance) {
            return RemoveComment.instance;
        }

        // Сохраняем ссылку на текущий экземпляр
        RemoveComment.instance = this;

        // Инициализация
        this._init(data.insertInto);

    }

    // ***************************************************************************
    // Инициализация
    // ***************************************************************************
    async _init(insertInto?: HTMLElement | null): Promise<void> {

        // Открытие
        await this._open(insertInto);

    }

    // ***************************************************************************
    // Открытие
    // ***************************************************************************
    async _open(insertInto?: HTMLElement | null): Promise<void> {

        try {

            // Шаблон диалога
            const tpl = this._template();
            if (!tpl) return;

            // Диалог
            this.modal = new Overlay(tpl, {
                type: "modal",
                insertInto,
                closeOnEsc: true,
                closeOnOverlay: true,
                onOpen: async () => await this._onOpen(),
                onBeforeClose: () => this._onBeforeClose()
            });

            // Открываем диалог
            this.modal.open();

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Обработчики
    // ***************************************************************************
    async _onOpen(): Promise<void> {

        try {

            // Шаблон — это и есть контент модалки (invariant: Overlay.content
            // хранит переданный .cdm-modal)
            const tpl = this.modal?.content;
            if (!tpl) return;

            // Подтверждение удаления
            let remove = tpl.querySelector(":scope >.footer [action-remove]");
            remove?.addEventListener("click", () => {
                this.callback?.(true);
                this.modal?.close();
            });

            // Отмена
            let close = tpl.querySelector(":scope >.footer [action-close]");
            close?.addEventListener("click", () => {
                this.callback?.(false);
                this.modal?.close();
            });

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Действия при закрытии диалога
    // ***************************************************************************
    _onBeforeClose(): void {

        // Удаляем экземпляр диалога
        RemoveComment.instance = null;

    }

    // ***************************************************************************
    // Шаблон диалога
    // ***************************************************************************
    _template(): HTMLElement | null {

        // invariant: корневой .cdm-modal входит в сам шаблон — querySelector
        // с текстовым HTML всегда находит его
        return new DOMParser().parseFromString(`

            <div class="cdm-modal remove-comment flex flex-col p-0 gap-0 ${CDM_MODAL_CLASSES()}">
                 <div class="${CDM_MODAL_HEADER_CLASSES()}">
                    <span class="flex flex-row gap-2 items-center font-semibold text-lg">${window._lc.forms.comments.dialogs.remove_comment.desc}</span>
                    ${Buttons.transparent({ shape: "circle", attributes: ["action-close"], icon: "x" })}
                </div>
                 <div class="${CDM_MODAL_CONTENT_CLASSES()}">

                    <div class="flex flex-col gap-2">
                        <span class="text-secondary">${window._lc.forms.comments.dialogs.remove_comment.text}</span>
                    </div>

                </div>
                <div class="${CDM_MODAL_FOOTER_CLASSES()}">
                    ${Buttons.create({
                        shape: "square",
                        attributes: ["action-close"],
                        classes: ["w-full"],
                        text: window._lc.forms.comments.dialogs.remove_comment.action_cancel
                    })}
                                ${Buttons.danger({
                        shape: "square",
                        attributes: ["action-remove"],
                        classes: ["w-full"],
                        text: window._lc.forms.comments.dialogs.remove_comment.action_remove
                    })}
                </div>
            </div>

        `, "text/html").querySelector<HTMLElement>(".cdm-modal");

    }

}
