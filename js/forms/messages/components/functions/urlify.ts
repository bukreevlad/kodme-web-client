// Импортируем utils
import { Logger } from "../../../../utils/logs/logger.js";
import { toastError } from "../../../../utils/ui/toast_error.js";
import { attach } from "../../../../utils/links/link_guard.js";

// Импортируем functions
import { colorizedBotCommand } from "./colorized_bot_command.js";
import { updateStateButtons } from "../../functions/update_state_buttons.js";

// Импортируем dialogs
import { MessageUrlClickConfirm } from "../dialogs/message-url-click-confirm/index.js";

// Импортируем requests
import { getInviteInfoRequest } from "../requests/get_invite_info.js";

// Импортируем forms
import { InviteChannel } from "../../../invite-channel/index.js";
import { InviteBroadcast } from "../../../invite-broadcast/index.js";
import { InviteMeet } from "../../../invite-meet/index.js";
import { UserProfile } from "../../../user-profile/index.js";
import { BotProfile } from "../../../bot-profile/index.js";
import { Messages } from "../../../messages/index.js";
import { BotApp } from "../../../bot-app/index.js";

// Импортируем функции облака
import { openMessageCloudLink } from "../../../cloud/functions/open_message_cloud_link.js";

// Импортируем типы
import type { MessageItem } from "../message.js";

/**
 * ***************************************************************************
 * urlify - расшивка текста сообщения после markdown-рендера: клики по командам
 * бота, mention'ам, приглашениям, облачным ссылкам и обычным URL.
 *
 * Работает по готовому DOM (`a[...]`-тегам из markdown-it) и дописывает
 * обработчики поверх разметки; ошибки рендера не роняют сообщение.
 * @param message - Родительский компонент сообщения.
 * @returns void
 * ***************************************************************************
 */
export function urlify(message: MessageItem): void {

    try {

        // Устанавливаем элементы
        let text = message.element.querySelector(":scope >.block >.presentation >.wrap-content >.wrap >.text-wrap >[data-text]");

        // Текст сообщения входит в шаблон — без него расшивать нечего
        if (!text) return;

        // =====================================

        // Команды бота
        text.querySelectorAll("a[data-bot-command]").forEach(link => {

            // Получаем данные
            let command = link.getAttribute("data-command");
            let entity = message.data.entities?.find(en => en.command === command && en.type === "bot-command");

            // Если есть command
            if (entity) {

                // Раскрашиваем команду
                link.innerHTML = colorizedBotCommand(entity.command, entity.args_array);

                // Клик: команда бота
                link?.addEventListener("click", async (event) => {
                    event.stopPropagation();
                    event.preventDefault();

                    // Получаем textarea
                    let textarea = message.form.textarea;
                    if (textarea) {
                        textarea.value = link.textContent;
                        textarea.focus();
                        updateStateButtons(message.form);
                    }

                });

            }

        });

        // =====================================

        // mentions
        text.querySelectorAll("a[data-mention]").forEach(link => {

            // Получаем данные
            let mentionLink = link.getAttribute("data-mention");
            let entity = message.data.entities?.find(en => en.link === mentionLink && en.type === "mention");

            // Если есть entity
            if (entity) {

                // Клик: открытие профиля
                link?.addEventListener("click", async (event) => {
                    event.stopPropagation();
                    event.preventDefault();

                    // Профиль пользователя
                    if (entity.userId && !entity.isBot) {
                        new UserProfile({ userId: entity.userId });
                    }

                    // Профиль бота
                    if (entity.userId && entity.isBot) {

                        // Проверяем передан ли в ссылке botapp
                        if (entity.botAppId) {
                            new BotApp({ appId: entity.botAppId });
                        } else {
                            new BotProfile({ botId: entity.userId });
                        }

                    }

                    // Профиль канала
                    if (entity.channelId) {
                        new Messages({ channelId: entity.channelId });
                    }

                });

            }

        });

        // =====================================

        // invites
        text.querySelectorAll("a[data-invite]").forEach(async link => {

            // Получаем данные
            let invite = link.getAttribute("data-invite");

            // Если есть invite
            if (invite) {

                // Клик: проверка ссылки
                link?.addEventListener("click", async (event) => {
                    event.stopPropagation();
                    event.preventDefault();

                    // Запрос
                    try {

                        // Выполняем запрос
                        let response = await getInviteInfoRequest({ invite: invite });

                        // Записываем link приглашения
                        response.data.invite = invite;

                        //Если это канал
                        if (response.data.channel_id) {
                            new InviteChannel(response.data);
                        }

                        // Если это трансляция
                        if (response.data.broadcast_id) {
                            new InviteBroadcast(response.data);
                        }

                        // Если это конференции
                        if (response.data.meet_id) {
                            new InviteMeet(response.data);
                        }

                    } catch (error) {

                        // Приглашение может быть недействительным, истёкшим или уже
                        // использованным. Сервер отдаёт код в message
                        // («INVITE_INVALID :: 116402»), поэтому сверяемся с кодом,
                        // а не с русским текстом «Приглашение недействительно» —
                        // такой строки на сервере нет и ветка была мёртвой.
                        toastError(error, {
                            context: "[app][messages][urlify][invite]",
                            codes: ["INVITE_INVALID", "INVITE_EXPIRED", "INVITE_MAX_USES_EXHAUSTED"],
                            text: window._lc.forms.messages.toasts.invite_not_valid
                        });

                        return false;
                    }

                });

            }

        });

        // =====================================

        // облачные ссылки (https://<host>/cloud/<token>)
        text.querySelectorAll("a[data-cloud-share-link]").forEach(async link => {

            // Получаем данные
            let token = link.getAttribute("data-cloud-share-link");

            // Если есть token
            if (token) {

                // Клик: открываем папку в облаке или окно информации о файле
                link?.addEventListener("click", async (event) => {
                    event.stopPropagation();
                    event.preventDefault();

                    // Обрабатываем облачную ссылку
                    await openMessageCloudLink(token);

                });

            }

        });

        // =====================================

        // links
        text.querySelectorAll("a[data-link]").forEach(link => {
            // Получаем значение атрибута
            let attrUrl = link.getAttribute("data-link");

            // Без атрибута парсить нечего (легаси здесь же падало в catch)
            if (!attrUrl) return;

            // Парсим URL из атрибута с базовым URL
            let attrUrlObj;
            try {
                // Используем текущий location как базовый URL для корректного парсинга
                attrUrlObj = new URL(attrUrl);
            } catch (e) {
                Logger.debug("[app][messages][urlify]: некорректный URL в data-link:", attrUrl);
                return;
            }

            // Ищем entity с таким же hostname (домен или IP)
            let entity = message.data.entities?.find(en => {
                if (en.type !== "link") return false;

                try {
                    // Без url сравнивать hostname не с чем (легаси здесь
                    // же ловилось catch'ем)
                    if (en.url == null) return false;
                    const entityUrlObj = new URL(en.url);
                    // Сравниваем по hostname (домен или IP)
                    return entityUrlObj.hostname === attrUrlObj.hostname;
                } catch (e) {
                    return false;
                }
            });

            // Если есть entity
            if (entity) {

                // Клик: проверка ссылки. Логику вынесли в LinkGuard, потому что
                // она повторялась в двух местах (messages,
                // channel-profile) и в копиях разошлась: в channel-profile
                // origin сравнивался без порта, из-за чего на :3000/:8080
                // свои ссылки считались внешними. Решение «своя/чужая»
                // принимает LinkGuard, диалог — наш, из этой же формы
                attach(link, {
                    url: entity.url,
                    onExternal: (href) => new MessageUrlClickConfirm({ url: href })
                });

            }
        });

        // =====================================

    } catch (error) {

        // Рендер ссылок не должен ронять всё сообщение: логируем и оставляем
        // текст как есть (ссылки останутся необработанными, но кликабельными).
        Logger.error("[app][messages][urlify]:", error);

    }

}
