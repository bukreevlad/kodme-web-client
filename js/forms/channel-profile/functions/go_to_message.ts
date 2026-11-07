// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";
import { toastError } from "../../../utils/ui/toast_error.js";

// Импортируем requests
import { getMessagesHistoryRequest } from "../../messages/requests/get_messages_history.js";

// Импортируем functions (форма сообщений)
import { goPointMessageHistory } from "../../messages/functions/go_point_message_hystory.js";

// Импортируем components
import { Toast } from "../../../components/toast.js";

// Импортируем forms
import { Messages } from "../../messages/index.js";

// Импортируем типы
import type { MessageRecord } from "../../messages/types.js";
import type { ChannelProfile } from "../types.js";
import { t } from "../../../utils/i18n/index.js";

/**
 * Сколько ждать первой отрисовки окна чата, мс. Нужно только при переходе
 * из профиля, открытого без чата: без таймаута ожидание молчащей сети или
 * пустого канала не завершилось бы вовсе.
 */
const FIRST_RENDER_TIMEOUT = 10000;

/**
 * Период проверки реестра форм сообщений, мс: по нему отслеживаем, что чат
 * «закрылся», пока грузился (группа с темами перенаправляет на список тем).
 */
const ALIVE_CHECK_INTERVAL = 250;

/**
 * ***************************************************************************
 * goToMessage - переход к сообщению из строки секции профиля канала.
 *
 * Закрывает профиль (под ним открывается чат канала) и запускает общий
 * механизм перехода к сообщению: если оно уже в окне чата — подсвечиваем его,
 * иначе пересобираем окно вокруг него запросами истории в обе стороны
 * (см. messages/functions/go_point_message_hystory.ts).
 * @param form - Форма профиля канала.
 * @param messageId - Id сообщения, к которому переходим.
 * @returns Promise, завершающийся после перехода либо ошибки в логе/тосте.
 * ***************************************************************************
 */
export async function goToMessage(form: ChannelProfile, messageId: string): Promise<void> {

    try {

        // Берём открытую форму чата канала: профиль чаще всего открывают поверх неё
        let chat = Messages.instances.get(form.channelId);

        // Чата может не быть (профиль открывали из списка чатов) — открываем:
        // конструктор-синглтон вернёт уже существующий инстанс, если чат
        // только что начали открывать в другом месте
        const isFirstOpen = !chat;
        if (!chat) chat = new Messages({ channelId: form.channelId });

        // Закрываем профиль — под ним открывается чат канала
        form.modal?.close();

        // invariant: форму только что создали либо достали из реестра — она есть
        const messagesForm = chat;

        // Первая загрузка окна у новой формы асинхронна и не отдаёт промиса,
        // поэтому ждём её отдельно: переход пересобирает окно вокруг сообщения,
        // и начинать это нужно после того, как форма отрисует своё окно,
        // иначе её пачка затёрла бы результат перехода
        if (isFirstOpen) await waitForFirstRender(messagesForm);

        // Если чат «закрылся», пока ждали первую отрисовку (например, группа
        // с темами открыла вместо него список тем) — переходить некуда
        if (Messages.instances.get(form.channelId) !== messagesForm) return;

        // Данные целевого сообщения: если оно уже в окне чата — берём их из
        // стора, и переход ограничится подсветкой и прокруткой
        let data: MessageRecord | undefined = messagesForm.store.get(messageId) ?? undefined;

        // Сообщения нет в окне — загружаем его содержимое: пересборка окна
        // вставляет в него именно эти данные, и без них на месте цели
        // оказался бы пустой пузырь
        if (!data) data = await loadMessageRecord(form.channelId, messageId) ?? undefined;

        // Сообщение недоступно (удалено либо доступ к нему закрыт)
        if (!data) {
            Toast.error(t("forms.channel_profile.toasts.message_not_found"), {
                type: "error",
                duration: 3000,
                position: "top-right"
            });
            return;
        }

        // Переход: подсветка сообщения в окне либо пересборка окна вокруг него
        await goPointMessageHistory({ form: messagesForm, data });

    } catch (error) {

        // Ошибка запросов/сокета — пользователь должен её увидеть
        toastError(error, {
            context: "[app][channel-profile][go-to-message]",
            fallback: t("forms.channel_profile.toasts.load_error")
        });

    }

}

/**
 * ***************************************************************************
 * loadMessageRecord - загрузка содержимого сообщения, которого нет в окне.
 *
 * Запрос истории отдаёт записи строго по стороне от курсора (id > cursor для
 * next, id < cursor для prev), поэтому целевое сообщение в ответах не
 * появляется. Достаём его через ближайшего соседа: соседа находим запросом
 * с offset = 1, а по соседу вынимаем само сообщение — тоже запросом с
 * offset = 1.
 * @param channelId - Id канала.
 * @param messageId - Id искомого сообщения.
 * @returns Запись сообщения либо null, если его достать не удалось.
 * ***************************************************************************
 */
async function loadMessageRecord(channelId: string, messageId: string): Promise<MessageRecord | null> {

    // Ближайший сосед сверху: если он есть, цель лежит прямо перед ним
    const newer = await getMessagesHistoryRequest({
        direction: "next",
        channel_id: channelId,
        cursor_id: messageId,
        offset: 1
    });

    const nextNeighbour = newer?.data?.[0];

    if (nextNeighbour) {

        const target = await getMessagesHistoryRequest({
            direction: "prev",
            channel_id: channelId,
            cursor_id: nextNeighbour.id,
            offset: 1
        });

        return target?.data?.[0] ?? null;

    }

    // Соседей сверху нет — сообщение последнее (либо единственное) в канале:
    // достаём его по ближайшему соседу снизу
    const older = await getMessagesHistoryRequest({
        direction: "prev",
        channel_id: channelId,
        cursor_id: messageId,
        offset: 1
    });

    const prevNeighbour = older?.data?.[0];

    if (prevNeighbour) {

        const target = await getMessagesHistoryRequest({
            direction: "next",
            channel_id: channelId,
            cursor_id: prevNeighbour.id,
            offset: 1
        });

        return target?.data?.[0] ?? null;

    }

    // Вокруг сообщения пусто — содержимое достать неоткуда
    return null;

}

/**
 * ***************************************************************************
 * waitForFirstRender - ждёт, пока открывшийся чат отрисует первое окно.
 *
 * Первая загрузка сообщений у формы асинхронна и нигде не отдаёт промиса,
 * поэтому ждём первого добавления в стор (item::added). Чат может «закрыться»
 * до отрисовки — такие случаи завершают ожидание досрочно по реестру форм.
 * @param chat - Экземпляр формы сообщений.
 * @returns Promise, разрешающийся после первой отрисовки либо по таймауту.
 * ***************************************************************************
 */
function waitForFirstRender(chat: Messages): Promise<void> {

    return new Promise((resolve) => {

        // Единая точка завершения: таймер, подписчик и проверка реестра
        // снимают друг друга, промис разрешается ровно один раз
        const finish = (): void => {
            clearInterval(aliveCheck);
            clearTimeout(timeout);
            unsubscribe();
            resolve();
        };

        // Первое добавление в стор означает, что пачка окна отрисована
        const unsubscribe = chat.store.on("item::added", finish);

        // Периодическая проверка реестра нужна для «мёртвого» открытия:
        // форма группы с темами снимает себя из реестра до первой отрисовки
        const aliveCheck = setInterval(() => {
            if (Messages.instances.get(chat.channelId) !== chat) finish();
        }, ALIVE_CHECK_INTERVAL);

        // Таймаут снимает промис при молчащей сети либо пустом канале
        const timeout = setTimeout(finish, FIRST_RENDER_TIMEOUT);

    });

}
