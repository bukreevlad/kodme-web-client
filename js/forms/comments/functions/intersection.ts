// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем типы
import type { Comments } from "../index.js";

/**
 * ***************************************************************************
 * intersection - единый обработчик видимости строк ленты комментариев.
 *
 * Поллинг реакций (commentReactionsUpdater.track) и отметки о прочтении
 * (lastViewedBatcher.schedule) подключены к этой же точке: наблюдатель
 * создаётся один раз в _onOpen с root — viewport скролла ленты.
 * @param entries - IntersectionObserverEntry.
 * @param observer - IntersectionObserver.
 * @param form - Экземпляр формы.
 * @returns void
 * ***************************************************************************
 */
export function intersection(entries: IntersectionObserverEntry[], observer: IntersectionObserver, form: Comments): void {

    try {

        // Форма обязательна для работы с Store
        if (!form) return;

        // Проходим по элементам
        for (let entry of entries) {

            // Пропускаем элементы, которых нет в DOM
            if (!entry.target.isConnected) continue;

            // Устанавливаем параметры
            let commentId = entry.target.getAttribute("data-id");

            // Без data-id комментарий не идентифицировать — пропускаем
            if (commentId == null) continue;

            // Проверяем пересечение объекта
            const isVisible = entry.isIntersecting || entry.intersectionRatio > 0;
            if (!isVisible) continue;

            // Поллинг реакций видимых комментариев (комментарий мог выпасть
            // из окна — track проверит наличие в Store через запрос)
            form.commentReactionsUpdater?.track(commentId, entry.isIntersecting);

            // Отметка «прочитано до» шлётся только по живым серверным
            // комментариям: черновик, исходящий и строка с ошибкой несут
            // локальный id (сервер их не знает), а заглушка удалённого
            // (is_deleted) сервером считается отсутствующей — во всех этих
            // случаях ушёл бы COMMENT_MISMATCH (131901)
            const record = form.store.get(commentId);
            const isServerComment = record
                && !record.is_deleted
                && !record.is_sending
                && !record.is_error_sending
                && record.id !== form.tempComment?.id;

            // Отметка «прочитано до»: батчер держит максимум и шлёт не чаще
            // раза в интервал, поэтому быстрый скролл не жжёт лимит запросов
            if (isServerComment) form.lastViewedBatcher?.schedule(commentId);

        }

    } catch (error) {
        Logger.error("[app][comments][intersection]", error);
    }

}
