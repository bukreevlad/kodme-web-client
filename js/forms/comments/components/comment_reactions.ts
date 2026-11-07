// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем components
import { Avatars } from "../../../components/avatars.js";

// Импортируем handlers
import { sendReactionHandler } from "./handlers/send_reaction.js";

// Импортируем типы
import type { CommentReaction } from "../types.js";
import type { Comments } from "../index.js";

/**
 * ***************************************************************************
 * commentReactions - блок реакций комментария: кнопки emoji со счётчиком,
 * стопкой аватарок и отметкой «моя реакция».
 *
 * Рендер идемпотентен: контейнер очищается и собирается заново — его вызывает
 * и fillItem строки, и sendReactionHandler после ответа сервера.
 * @param form - Экземпляр формы.
 * @param item - DOM-узел строки комментария.
 * @param reactions - Список реакций комментария.
 * @returns void
 * ***************************************************************************
 */
export function commentReactions(form: Comments, item: HTMLElement, reactions: CommentReaction[] | undefined): void {

    try {

        // Если не передан DOM-узел
        if (!item) return;

        // Контейнер реакций (входит в buildItem)
        const container = item.querySelector<HTMLElement>(":scope reactions");
        if (!container) return;
        container.innerHTML = "";

        // Нет реакций — очищенный контейнер прячется через empty:hidden
        if (!reactions?.length) return;

        // Проходим по реакциям
        reactions.forEach(reaction => {

            // Создать реакцию
            const element = templateReaction(reaction);

            // Отображаем аватарки
            const avatarsContainer = element.querySelector("[data-avatars]");
            const countsEl = element.querySelector("[data-counts]");

            // Получаем аватарки
            const avatars = reaction?.avatars || [];

            // Если реакций меньше 3 — счётчик скрыт (аватарки и так всё покажут)
            if (Number(reaction.count) <= 3) {
                countsEl?.classList.add("hidden");
            } else {
                countsEl?.classList.remove("hidden");
            }

            // Проходим по аватарам
            avatars.forEach(user => {
                const avatarEl = document.createElement("div");
                Avatars.create({
                    element: avatarEl,
                    id: user.user_id ?? "",
                    name: user.display_name ?? "",
                    image: user.avatar ?? null,
                    size: "2xs"
                });
                avatarsContainer?.append(avatarEl);
            });

            // Если эта реакция была и у пользователя
            if (reaction.is_selected) {
                element.classList.add("bg-[var(--color-brand)]", "dark:bg-[var(--color-brand)]");
                // Раньше сюда передавался boolean — DOM приводит его к "true"
                element.setAttribute("selected", "true");
            } else {
                element.removeAttribute("selected");
            }

            // Добавляем в шаблон
            container.appendChild(element);

            // Клик: реакция (без эмодзи переключать нечего — серверу не передать)
            element.addEventListener("click", (event) => {

                // Не даём клику дойти до строки (свайп/контекстное меню)
                event.stopPropagation();
                if (reaction.reaction === undefined) return;
                sendReactionHandler(form, item, reaction.reaction);

            });

        });

    } catch (error) {
        Logger.error("[app][comments][reactions]", error);
    }

}

/**
 * ***************************************************************************
 * Шаблон элемента реакции.
 * @param data - Emoji реакция.
 * @returns DOM-элемент кнопки реакции.
 * ***************************************************************************
 */
function templateReaction(data: CommentReaction): HTMLElement {

    // Мы используем DOMParser для создания DOM без innerHTML
    const element = new DOMParser().parseFromString(`
        <button class="item flex flex-row rounded-3xl gap-1 p-1 items-center cursor-pointer transition-colors duration-150 bg-[var(--color-black)]/5 hover:bg-[var(--color-black)]/10 active:bg-[var(--color-black)]/15 dark:bg-[var(--color-white)]/10 dark:hover:bg-[var(--color-white)]/15 dark:active:bg-[var(--color-white)]/20">
            <span class="font-emoji text-lg leading-none">${data.reaction}</span>
            <span data-counts>${data.count}</span>
            <div data-avatars class="flex flex-row items-center -space-x-2"></div>
        </button>
    `, "text/html").querySelector<HTMLButtonElement>("button");

    // Своя разметка всегда содержит «button» — без элемента элемент списка не создаётся
    if (!element) throw new Error("Не найден шаблон: button");

    return element;

}
