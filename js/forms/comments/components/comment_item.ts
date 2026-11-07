// Импортируем utils
import { Avatars } from "../../../components/avatars.js";
import { TimeAgoFormatter } from "../../../utils/date/time_ago_formatter.js";
import { unescapeHtml } from "../../../utils/string/unescape_html.js";

// Импортируем functions
import { getSessionUserId } from "../../main/functions/session_identity.js";
import { isValidEmojiOnly } from "../../messages/components/functions/render_only_emoji.js";

// Импортируем components (вложенные)
import { commentAttaches } from "./comment_attaches.js";
import { createCommentReply } from "./comment_reply.js";
import { commentReactions } from "./comment_reactions.js";

// Импортируем типы
import type { Comments } from "../index.js";
import type { CommentRecord } from "../types.js";

/**
 * ***************************************************************************
 * createCommentItem - фабрика строки комментария.
 *
 * Единая точка входа рендера: события Store (live-комментарии) и первая
 * загрузка истории используют одну и ту же фабрику. Строка содержит
 * цитату ответа, аватар, автора, время, текст, вложения и реакции.
 * @param form - Экземпляр формы.
 * @param data - Данные комментария.
 * @returns DOM-узел строки комментария.
 * ***************************************************************************
 */
export function createCommentItem(form: Comments, data: CommentRecord): HTMLElement {

    // Строим разметку
    const item = buildItem();

    // Привязываем узлы и заполняем данными
    fillItem(form, item, data);

    // Служебный id для поиска строки в DOM
    item.dataset.id = data.id;

    // Возвращаем узел
    return item;

}

/**
 * ***************************************************************************
 * updateCommentItem - перезаполнение строки данными комментария.
 *
 * Подписка `item::updated::<id>` дергает её после изменений Store (снятие
 * флагов is_sending/is_error_sending, свежая гидратация с сервера): fillItem
 * идемпотентен — аватар/текст перезаписываются, вложения пересобираются целиком.
 * @param form - Экземпляр формы.
 * @param item - DOM-узел строки.
 * @param data - Новые данные комментария.
 * ***************************************************************************
 */
export function updateCommentItem(form: Comments, item: HTMLElement, data: CommentRecord): void {
    fillItem(form, item, data);
}

/**
 * ***************************************************************************
 * Разметка строки комментария.
 * @returns DOM-узел строки.
 * ***************************************************************************
 */
function buildItem(): HTMLElement {

    // Мы используем DOMParser для создания DOM без innerHTML
    return new DOMParser().parseFromString(`

        <div class="comment-item flex flex-row gap-2 py-1 w-full">
            <div class="block flex flex-row px-3 w-full max-w-[var(--messages-block-max-width)] m-auto">
                <div class="presentation relative flex flex-row gap-2 w-full">
                    <div class="cdm-avatar relative shrink-0"></div>
                    <div class="wrap-content flex flex-col max-w-[85%]">
                        <div class="wrap flex flex-col w-full max-w-full p-2 gap-1 overflow-hidden rounded-xl shadow-xs">
                            <div data-reply-block class="empty:hidden"></div>
                            <div class="flex flex-row gap-2 items-baseline">
                                <span data-display-name class="font-semibold text-sm text-secondary truncate"></span>
                                <span data-created-at class="text-muted text-xs whitespace-nowrap"></span>
                            </div>
                            <attaches class="relative flex flex-col empty:hidden gap-0">
                                <div data-media class="relative grid gap-1 empty:hidden"></div>
                                <div data-documents class="flex flex-col empty:hidden"></div>
                                <div data-audios class="relative flex flex-col empty:hidden gap-0"></div>
                            </attaches>
                            <div data-text class="leading-[1.3] break-words whitespace-pre-line empty:hidden"></div>
                        </div>
                        <reactions class="flex flex-row flex-wrap gap-1 p-2 px-0 items-center empty:hidden"></reactions>
                    </div>
                </div>
            </div>
        </div>

    `, "text/html").querySelector<HTMLElement>(".comment-item")!;

}

/**
 * ***************************************************************************
 * Заполнение строки данными комментария.
 * @param form - Экземпляр формы.
 * @param item - DOM-узел строки.
 * @param data - Данные комментария.
 * ***************************************************************************
 */
function fillItem(form: Comments, item: HTMLElement, data: CommentRecord): void {

    // Узлы входят в buildItem — invariant-селекторы безопасны
    const avatarElement = item.querySelector<HTMLElement>(":scope .cdm-avatar");
    const displayName = item.querySelector<HTMLElement>(":scope [data-display-name]");
    const createdAt = item.querySelector<HTMLElement>(":scope [data-created-at]");
    const text = item.querySelector<HTMLElement>(":scope [data-text]");

    // Аватар: id автора даёт стабильный цвет/документ
    Avatars.create({
        element: avatarElement,
        id: data.created_user_id ?? data.id,
        name: data.display_name ?? "",
        image: data.avatar ?? null,
        size: "sm",
        wrapClasses: ["rounded-full"]
    });

    // Автор и время
    if (displayName) displayName.textContent = data.display_name ?? "";
    if (createdAt && data.created_at) createdAt.textContent = new TimeAgoFormatter(data.created_at).formattedTime;

    // Текст комментария (сервер отдаёт HTML-экранированным — раскодируем;
    // комментарий без текста — только вложения, текст-контейнер пуст)
    //
    // Удалённый комментарий: сервер не присылает ни текста, ни вложений —
    // строка заменяется заглушкой «Комментарий удалён» (светлым курсивом,
    // классы переключаются toggle — строка перерисовывается многократно)
    if (text) {

        if (data.is_deleted) {
            text.textContent = window._lc.forms.comments.removed_comment;
            text.classList.add("italic", "text-muted");
        } else {
            text.textContent = data.text ? unescapeHtml(data.text) : "";
            text.classList.remove("italic", "text-muted");
        }

    }

    // Маркеры «отправляется»/«ошибка отправки» переключаются toggle: строка
    // обновляется и после ack (снятие маркера), а не только при рендере
    item.classList.toggle("opacity-60", Boolean(data.is_sending || data.is_error_sending));

    // Вложения (пересобираются целиком — фабрики сами регистрируют свои
    // элементы в __domElements__ для прогресса загрузки)
    commentAttaches(data, item);

    // Цитата ответа (у корневых комментариев reply_to_comment отсутствует)
    const replyBlock = item.querySelector<HTMLElement>(":scope [data-reply-block]");
    if (replyBlock) {

        // Очищаем и заново собираем (идемпотентность перезаполнения)
        replyBlock.innerHTML = "";
        if (data.reply_to_comment?.id) {
            replyBlock.append(createCommentReply(form, data.reply_to_comment));
        }

    }

    // Реакции (пересобираются целиком — контейнер очищается внутри)
    commentReactions(form, item, data.reactions);

    // Свои комментарии — вправо: presentation получает justify-end, а CSS из
    // comments.css красит пузырь акцентным тоном бренда (как у своих
    // сообщений; в сообществах-каналах сообщения так не выделяются, но
    // для комментариев «свои справа» — принятый дизайн)
    const presentation = item.querySelector<HTMLElement>(":scope .presentation");
    if (presentation) {
        presentation.classList.toggle("justify-end", data.created_user_id === getSessionUserId());
    }

    // Только эмодзи (1-3) — крупный кегль и прозрачный пузырь: та же
    // проверка isValidEmojiOnly, что у сообщений (сверяем шаблон/CSS)
    item.classList.toggle("only-emoji", isValidEmojiOnly(data.text ?? ""));

    // Данные строки для обработчиков формы
    item.dataset.entityId = form.postId;

}
