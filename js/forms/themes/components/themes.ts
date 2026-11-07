// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { Icons } from "../../../utils/icons.js";
import { LocalStorage } from "../../../utils/local_storage.js";
import { Themes as AppThemes } from "../../../utils/themes.js";

// Импортируем forms
import { ThemeEdit } from "../../theme-edit/index.js";

// Импортируем типы
import { isThemeItem, ThemeListItem } from "../types.js";
import type { Themes } from "../index.js";
import type { SessionProfile } from "../../menu/types.js";
import type { StoreEventName } from "../../../utils/store.js";

/**
 * ***************************************************************************
 * Создание DOM-элемента строки темы оформления.
 *
 * Был классом-фабрикой (constructor возвращал элемент) — переведён в
 * функцию по канону миграции. Элемент живёт в data.__domElements__ (для
 * удаления копий при выгрузке из стора) и подписывается на точечное
 * событие обновления `item::updated::<id>`.
 * @param form - Экземпляр формы.
 * @param data - Данные элемента.
 * @returns DOM-элемент строки темы.
 * ***************************************************************************
 */
export function createThemeItem(form: Themes, data: ThemeListItem): HTMLElement {

    // Создаем DOM-элемент из шаблона
    const element = createTemplate();

    // Актуальные данные элемента (переприсваиваются при обновлении)
    let currentData = data;

    /**
     * ***************************************************************************
     * Установка/перерисовка данных.
     * @param itemData - Данные элемента.
     * ***************************************************************************
     */
    const setup = (itemData: ThemeListItem): void => {

        try {

            // Сохраняем актуальные данные
            currentData = itemData;

            // Сессия пользователя (user хранится как unknown на границе
            // localStorage — invariant: форма читает из него id профиля,
            // канон — menu/handlers/profile.ts)
            const session = LocalStorage.session;
            const sessionUser = session?.user as SessionProfile;

            // Устанавливаем элементы
            const name = element.querySelector(":scope [data-name]");
            const author = element.querySelector(":scope [data-author]");
            const edit = element.querySelector(":scope [action-edit]");

            // Отображаем данные
            if (name) name.textContent = itemData.name;
            if (author) author.textContent = itemData.author_name;

            // Если не текущий пользователь — убираем кнопку редактирования
            if (itemData.created_user_id !== sessionUser.id) {
                edit?.remove();
            }

        } catch (error) {
            Logger.error(error);
        }

    };

    /**
     * ***************************************************************************
     * Обработчики элемента.
     * ***************************************************************************
     */
    const actions = (): void => {

        // Применить тему
        element.addEventListener("click", () => AppThemes.setAppTheme({ theme: currentData, update_session: true }));

        // Редактировать тему
        const edit = element.querySelector("[action-edit]");
        if (edit) {
            edit.addEventListener("click", (event) => {
                event.stopPropagation();
                new ThemeEdit({ themeId: currentData.id });
            });
        }

    };

    /**
     * ***************************************************************************
     * Подписка на точечное событие обновления элемента в сторе.
     * ***************************************************************************
     */
    const subscribeToUpdates = (): void => {

        try {

            // Формируем уникальное имя события
            const itemUpdatedEvent: StoreEventName = `item::updated::${currentData.id}`;

            // Подписываемся и сохраняем функцию отписки
            const unsubscribe = form.store.on(itemUpdatedEvent, (payload) => {

                // Стор шлёт payload как unknown — сверяемся guard'ом
                if (!isThemeItem(payload)) return;

                // Обновляем данные
                setup(payload);

            });

            // Сохраняем функцию отписки в data, чтобы форма могла вызвать её при удалении
            currentData.__unsubscribeStore__ = unsubscribe;

        } catch (error) {
            Logger.error(error);
        }

    };

    // Записываем ссылку на DOM-элемент в данные
    if (!currentData.__domElements__) {
        currentData.__domElements__ = [];
    }
    currentData.__domElements__.push(element);

    // Устанавливаем начальные данные
    setup(currentData);

    // Прикрепляем обработчики событий
    actions();

    // Подписываем на обновление
    subscribeToUpdates();

    // Возвращаем сам элемент для вставки в DOM
    return element;

}

/**
 * ***************************************************************************
 * Шаблон элемента: DOMParser для безопасного создания DOM без innerHTML.
 * @returns DOM-элемент строки темы.
 * ***************************************************************************
 */
function createTemplate(): HTMLElement {

    const element = new DOMParser().parseFromString(`
        <div class="item flex flex-row gap-3 p-2 hover:bg-[var(--second-bg)] active:bg-[var(--second-bg)] rounded-lg cursor-pointer">
            <div class="flex flex-col gap-1 w-full">
                <span data-name class="font-semibold text-lg truncate"></span>
                <span data-author class="text-secondary truncate"></span>
            </div>
            <button action-edit class="rounded-full">${Icons.icon("pencil-minus")?.outerHTML}</button>
        </div>
    `, "text/html").querySelector<HTMLElement>(".item");

    // Своя разметка всегда содержит «.item» — без элемента элемент списка не создаётся
    if (!element) throw new Error("Не найден шаблон: .item");

    return element;

}
