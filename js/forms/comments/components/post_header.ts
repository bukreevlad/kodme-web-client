// Импортируем utils
import { Avatars } from "../../../components/avatars.js";
import { TimeAgoFormatter } from "../../../utils/date/time_ago_formatter.js";
import { getDeclension } from "../../../utils/string/declensions.js";
import { unescapeHtml } from "../../../utils/string/unescape_html.js";
import * as Attachments from "../../../utils/messages/attachments.js";

// Импортируем типы
import type { Comments } from "../index.js";
import type { MessageData } from "../../messages/components/types.js";

/**
 * ***************************************************************************
 * renderPostHeader - карточка поста в шапке формы комментариев.
 *
 * Компактная карта поста (аватар, автор, время, текст, счётчик вложений):
 * намеренно НЕ переиспользуется строка сообщения из формы сообщений, чтобы
 * внутрь ветки комментариев не тянулись строка комментариев, жесты и
 * служебные хуки MessageItem.
 * @param form - Экземпляр формы.
 * @returns DOM-узел карточки поста (null, если данных поста нет).
 * ***************************************************************************
 */
export function renderPostHeader(form: Comments): HTMLElement | null {

    // Данные поста заполняет _onBeforeOpen из ответа [comment]: open
    const post = form.post;
    if (!post) return null;

    // Строим карточку
    const card = buildCard();

    // Заполняем карточку данными поста
    fillCard(card, post);

    // Возвращаем узел
    return card;

}

/**
 * ***************************************************************************
 * Разметка карточки поста.
 * @returns DOM-узел карточки.
 * ***************************************************************************
 */
function buildCard(): HTMLElement {

    // Мы используем DOMParser для создания DOM без innerHTML
    return new DOMParser().parseFromString(`

        <div class="post-header flex flex-row gap-2 px-3 py-2 w-full">
            <div class="flex flex-row gap-2 w-full max-w-[var(--messages-block-max-width)] m-auto">
                <div class="cdm-avatar relative shrink-0"></div>
                <div class="wrap flex flex-col gap-1 w-full max-w-full p-2 overflow-hidden rounded-xl shadow-xs bg-[var(--messages-wrap-bg)]">
                    <div class="flex flex-row gap-2 items-baseline">
                        <span data-name class="font-semibold text-sm truncate"></span>
                        <span data-created-at class="text-muted text-xs whitespace-nowrap"></span>
                    </div>
                    <div data-text class="leading-[1.3] break-words whitespace-pre-line empty:hidden"></div>
                    <div data-attaches class="text-xs text-secondary empty:hidden"></div>
                </div>
            </div>
        </div>

    `, "text/html").querySelector<HTMLElement>(".post-header")!;

}

/**
 * ***************************************************************************
 * Заполнение карточки данными поста.
 * @param card - DOM-узел карточки.
 * @param post - Данные поста (гидратированное сообщение).
 * ***************************************************************************
 */
function fillCard(card: HTMLElement, post: MessageData): void {

    // Узлы входят в buildCard — invariant-селекторы безопасны
    const avatarElement = card.querySelector<HTMLElement>(":scope .cdm-avatar");
    const name = card.querySelector<HTMLElement>(":scope [data-name]");
    const createdAt = card.querySelector<HTMLElement>(":scope [data-created-at]");
    const text = card.querySelector<HTMLElement>(":scope [data-text]");
    const attaches = card.querySelector<HTMLElement>(":scope [data-attaches]");

    // Аватар: id поста даёт стабильный цвет/документ для карточки
    Avatars.create({
        element: avatarElement,
        id: post.created_user_id ?? post.id,
        name: post.display_name ?? "",
        image: post.avatar ?? null,
        size: "sm",
        wrapClasses: ["rounded-full"]
    });

    // Автор и время
    if (name) name.textContent = post.display_name ?? "";
    if (createdAt && post.created_at) createdAt.textContent = new TimeAgoFormatter(post.created_at).formattedTime;

    // Текст поста (сервер отдаёт HTML-экранированным — раскодируем для
    // отображения, переводы строк сохраняем)
    if (text) {

        // Пустой текст не рисуем (пост-«фотография»: текста может не быть)
        const value = post.text ? unescapeHtml(post.text) : "";
        text.textContent = value;
        if (!value) text.classList.add("hidden");

    }

    // Вложения: компактная строка-счётчик (полная галерея поста — не входит
    // в карточку; медиа поста уже видно над формой в ленте сообщений)
    if (attaches) {

        const filesCount = Attachments.count(post.attachments ?? []);

        // Пустую строку прячем
        if (!filesCount) {
            attaches.classList.add("hidden");
        } else {
            attaches.textContent = `${filesCount} ${getDeclension(filesCount, window._lc.forms.comments.dec_files)}`;
        }

    }

}
