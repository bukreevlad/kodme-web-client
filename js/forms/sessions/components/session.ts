// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Avatars } from "../../../components/avatars.js";
import { Buttons } from "../../../components/buttons.js";

// Импортируем handlers
import { checkHandler } from "../handlers/check.js";
import { removeHandler } from "../handlers/remove.js";

// Импортируем типы
import type { StoredSession } from "../../../utils/local_storage.js";
import type { AvatarImageDocument } from "../../../components/avatars.js";
import type { Sessions } from "../index.js";

/**
 * Данные пользователя в элементе списка сессий: то, что реально читает
 * компонент из поля `user` сессии (пишут его ответ `/api/v1/auth/check`
 * и сохранение сессии после подтверждения кода).
 */
export interface SessionUserData {
    /** Id пользователя (нет у сессии до первой проверки). */
    id?: string;
    /** Отображаемое имя. */
    display_name: string;
    /** Email. */
    email: string;
    /** Документ аватара. */
    avatar?: AvatarImageDocument | null;
}

/**
 * Элемент списка сессий в Store формы: сессия из localStorage плюс
 * ссылки на DOM-копии элемента (для удаления при выгрузке из Store).
 */
export type SessionItemData = Pick<StoredSession, keyof StoredSession> & {
    /** DOM-копии элемента списка (для удаления при выгрузке из Store). */
    __domElements__?: HTMLElement[];
};

/**
 * Guard: похож ли payload события Store на элемент списка сессий.
 * @param value - Payload события хранилища.
 * @returns Да, если это элемент с идентификатором.
 */
export function isSessionItemData(value: unknown): value is SessionItemData {
    if (!value || typeof value !== "object") return false;

    // Сужение unknown через in: элемент хранилища обязан содержать id
    return "id" in value;
}

/**
 * ***************************************************************************
 * UserSessionItem - строка сохранённой сессии в списке формы выбора сессий.
 * ***************************************************************************
 */
export class UserSessionItem {

    /** Форма-владелец элемента. */
    form: Sessions;

    /** Данные сессии. */
    data: SessionItemData;

    /** DOM-элемент строки списка. */
    element: HTMLElement;

    /**
     * ***************************************************************************
     * Инициализация: принимает начальные данные.
     * @param form - Форма-владелец.
     * @param data - Данные сессии.
     * ***************************************************************************
     */
    constructor(form: Sessions, data: SessionItemData) {

        // Записываем данные
        this.form = form;
        this.data = data;

        // Создаем DOM-элемент из шаблона
        this.element = this._template();

        // Записываем ссылку на dom элемент
        if (!this.data.__domElements__) {
            this.data.__domElements__ = [];
        }
        this.data.__domElements__.push(this.element);

        // Устанавливаем начальные данные
        this._setup(this.data);

        // Прикрепляем обработчики событий
        this._actions();

    }

    // ***************************************************************************
    // Шаблон элемента (Private Method)
    // Используем DOMParser для безопасного и чистого создания элемента
    // ***************************************************************************
    _template(): HTMLElement {

        const element = new DOMParser().parseFromString(`
            <div class="item flex flex-row items-center gap-2.5 p-2.5 rounded-lg bg-[var(--second-bg)]/40 transition-all duration-200 hover:bg-[var(--second-bg)] cursor-pointer select-none">
                <div class="cdm-avatar relative shrink-0"></div>

                <div class="flex flex-col gap-0.5 justify-center min-w-0 flex-1">
                    <span class="display-name font-semibold text-sm truncate"></span>
                    <span class="email font-mono text-xs text-muted truncate"></span>
                </div>

                ${Buttons.create({
                    intent: "transparent",
                    shape: "circle",
                    attributes: ["action-remove"],
                    icon: "trash"
                })}
            </div>
        `, "text/html").querySelector<HTMLElement>(".item");

        // Своя разметка всегда содержит «.item» — без элемента строка не создаётся
        if (!element) throw new Error("Не найден шаблон: .item");

        return element;

    }

    // ***************************************************************************
    // Установка/Перерисовка данных (Private Method)
    // ***************************************************************************
    _setup(data: SessionItemData): void {

        try {

            // Сохраняем актуальные данные
            this.data = data;

            // Устанавливаем элементы
            const avatar = this.element?.querySelector<HTMLElement>(".cdm-avatar");

            // invariant: user_data сессии приходит с сервера в фиксированном
            // виде { display_name, email, id, avatar } (см. ответ auth/check
            // и сохранение после confirm) — читаем поля этим сужением unknown
            const user = data.user as SessionUserData;
            const displayName = this.element.querySelector(".display-name");
            const email = this.element.querySelector(".email");
            if (displayName) displayName.textContent = user.display_name;
            if (email) email.textContent = user.email;

            // Аватар
            new Avatars({
                element: avatar,
                id: user.id,
                name: user.display_name,
                image: user.avatar,
                size: "md"
            });

        } catch (error) {
            Logger.error(error);
        }

    }

    // ***************************************************************************
    // Обработчики (Private Method)
    // ***************************************************************************
    _actions(): void {

        // Авторизация
        this.element?.addEventListener("click", () => checkHandler(this.form, this.data));

        // Удалить
        const remove = this.element?.querySelector("[action-remove]");
        remove?.addEventListener("click", (event) => removeHandler(event, this));

    }

    // ***************************************************************************
    // Геттер для удобной вставки в DOM
    // ***************************************************************************
    getDOM(): HTMLElement | null {
        return this.element;
    }

    // ***************************************************************************
    // Геттер для удобного получения data
    // ***************************************************************************
    getData(): SessionItemData {
        return this.data;
    }

}
