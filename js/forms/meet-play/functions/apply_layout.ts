// Импортируем utils
import { Logger } from "../../../utils/logs/logger.js";

// Импортируем functions
import { LAYOUTS, pickFocus } from "./parse_room_state.js";

// Импортируем типы
import { isMeetLayout } from "../types.js";
import type { MeetLayout } from "../types.js";
import type { MeetPlay } from "../index.js";

/**
 * Классы, которыми размечено состояние сетки. Держатся в константах,
 * чтобы JS и CSS гарантированно говорили об одном и том же.
 */
const LAYOUT_CLASSES: Record<MeetLayout, string> = {
    grid: "meet-layout-grid",
    spotlight: "meet-layout-spotlight",
    sidebar: "meet-layout-sidebar",
    presentation: "meet-layout-presentation"
};

/**
 * Длительность анимации «устаивания» сетки. Должна совпадать с
 * `meet-settle` в css/forms/meet-play.css: класс снимается по таймеру,
 * а не по событию animationend (см. settleLayout).
 */
const SETTLE_MS = 240;

/**
 * ***************************************************************************
 * Перестраивает сетку участников под выбранный режим.
 *
 * Четыре режима:
 *   - `grid`         — все участники равными плитками, обычная сетка;
 *   - `spotlight`    — один крупно, остальные рядами внизу;
 *   - `sidebar`      — один крупно, остальные колонкой сбоку;
 *   - `presentation` — крупно тот, кто показывает экран; если демонстрации
 *                      нет, ведёт себя как `spotlight`.
 *
 * Плитки не пересоздаются: функция только раскладывает существующие
 * элементы по контейнерам, поэтому видео не перезапускается при смене режима.
 * @param form - Экземпляр формы.
 * @returns void
 * ***************************************************************************
 */
export function applyLayout(form: MeetPlay): void {

    try {

        const list = form.list;
        if (!list) return;

        // ---------- MODE ----------
        // Неизвестный режим не должен ломать сетку — откатываемся на "grid"
        const layout = isMeetLayout(form.layout) ? form.layout : "grid";

        // Какой режим отрисован прямо сейчас: по нему решаем, был ли
        // переход или это просто перестроение из-за нового участника
        const previousLayout = (Object.keys(LAYOUT_CLASSES) as MeetLayout[])
            .find(key => list.classList.contains(LAYOUT_CLASSES[key]));

        // Снимаем класс предыдущего режима со списка
        for (const cssClass of Object.values(LAYOUT_CLASSES)) {
            list.classList.remove(cssClass);
        }
        list.classList.add(LAYOUT_CLASSES[layout]);
        // ---------- MODE ----------

        // ---------- TRANSITION ----------
        // Плавное «устаивание» сетки при смене режима (пункт 6.8).
        // Настоящий морфинг невозможен: у сетки и у полосы разный
        // `display`, а он не анимируется, поэтому плитки за один кадр
        // просто переезжают. Короткая анимация даёт глазу время за
        // перемещением и убирает ощущение рывка
        if (previousLayout && previousLayout !== layout) {
            settleLayout(list, form);
        }
        // ---------- TRANSITION ----------

        // ---------- STRIP ----------
        // Полоса остальных участников нужна всем режимам, кроме "grid".
        // Создаём её один раз и переиспользуем: пересоздавать контейнер
        // на каждом перестроении значило бы перемонтировать все <video>.
        // Видимость полосы в каждом режиме решает CSS (см. meet-play.css),
        // поэтому из JS мы её не переключаем.
        const strip = getOrCreateStrip(list);
        // ---------- STRIP ----------

        // ---------- FOCUS ----------
        // В "grid" порядок плиток не важен, поэтому раскладываем всё
        // обратно в один список: иначе плитки, уехавшие в полосу при
        // предыдущем режиме, остались бы в ней навсегда
        if (layout === "grid") {
            strip.querySelectorAll(":scope >.item").forEach(item => list.appendChild(item));
            // Полосу возвращаем в конец: в сетке она скрыта, но в DOM
            // не должна болтаться между плитками — иначе порядок в
            // разметке перестаёт совпадать с визуальным
            list.appendChild(strip);
            return;
        }

        // ---------- NORMALIZE ----------
        // Возвращаем все плитки в список в порядке документа. Без этого
        // следующие два шага видели бы только крупную плитку: после
        // предыдущей раскладки все остальные лежат в полосе и прямыми
        // потомками списка уже не являются. Фокус тогда не мог уехать
        // на участника из полосы — ни на закреплённого, ни на
        // того, кто только что начал показывать экран в режиме
        // презентации: оба лежат именно там.
        // Перенос не трогает видео — <video> переезжает вместе с плиткой.
        const tiles = Array.from(list.querySelectorAll(":scope .item"));
        tiles.forEach(item => list.appendChild(item));
        // ---------- NORMALIZE ----------

        // Кого показываем крупно
        const focusIdentity = findFocusIdentity(form, layout);

        // Раскладываем плитки: крупная — в список, остальные — в полосу.
        // Крупную вставляем ПЕРЕД полосой (insertBefore, а не appendChild):
        // полоса живёт последним потомком списка, и appendChild задвинул бы
        // крупную плитку под неё — в колоночной раскладке та оказалась бы
        // сверху, а в строковой — справа от полосы.
        let hasFocus = false;
        tiles.forEach(item => {
            if ((item as HTMLElement).dataset.identity === focusIdentity) {
                list.insertBefore(item, strip);
                hasFocus = true;
            } else {
                strip.appendChild(item);
            }
        });

        // Фокус ищется среди отрисованных плиток, поэтому он всегда есть.
        // Но если участник ушёл между синхронизацией и разметкой, крупной
        // плитки не останется — показываем первую доступную, чтобы не
        // оставлять пользователя с пустым экраном
        if (!hasFocus) {
            const fallback = strip.querySelector(":scope >.item");
            if (fallback) list.insertBefore(fallback, strip);
        }
        // ---------- FOCUS ----------

    } catch (error) {
        Logger.error("🚨 [meet-play]: Ошибка применения режима сетки:", error);
    }

}

/**
 * Перезапускает анимацию «устаивания» сетки.
 *
 * Класс снимается и ставится заново с принудительным чтением раскладки:
 * без этого повторное добавление того же класса в том же кадре браузер
 * проигнорирует и анимация не начнётся второй раз.
 * @param list - Контейнер сетки.
 * @param form - Экземпляр формы (нужен для хранения таймера).
 * @returns void
 */
function settleLayout(list: HTMLElement, form: MeetPlay): void {

    list.classList.remove("meet-layout-settling");

    // Принудительный reflow: только он заставляет браузер считать
    // повторное добавление класса новым изменением
    void list.offsetWidth;

    list.classList.add("meet-layout-settling");

    // Класс снимаем сами: ждать animationend опасно — анимация
    // отключается в prefers-reduced-motion и событие не придёт вовсе
    if (form.settleTimer !== null) clearTimeout(form.settleTimer);
    form.settleTimer = setTimeout(() => {
        list.classList.remove("meet-layout-settling");
    }, SETTLE_MS);

}

/**
 * Возвращает полосу «остальных» участников, создавая её при необходимости.
 * @param list - Контейнер сетки.
 * @returns Контейнер полосы.
 */
function getOrCreateStrip(list: HTMLElement): HTMLElement {

    // Полоса уже есть — переиспользуем
    let strip = list.querySelector<HTMLElement>(":scope >[data-strip]");
    if (strip) return strip;

    strip = document.createElement("div");
    strip.classList.add("meet-strip");
    strip.setAttribute("data-strip", "");

    // Полоса всегда в конце списка, чтобы крупная плитка оставалась первой
    list.appendChild(strip);

    return strip;

}

/**
 * Определяет, чью плитку показывать крупно.
 *
 * Собирает факты (что реально нарисовано, в каком порядке, кто делится
 * экраном) и передаёт их в чистую `pickFocus`, где живёт сам порядок
 * приоритетов. Здесь остаётся только работа с DOM и хранилищем.
 * @param form - Экземпляр формы.
 * @param layout - Режим сетки.
 * @returns Identity участника или null.
 */
function findFocusIdentity(form: MeetPlay, layout: MeetLayout): string | null {

    // Что реально отрисовано: иначе крупной станет плитка, которой нет в DOM
    const rendered = Array.from(form.list?.querySelectorAll<HTMLElement>(":scope .item") || [])
        .map(item => item.dataset.identity)
        .filter((identity): identity is string => Boolean(identity));

    if (rendered.length === 0) return null;

    // ---------- ПОРЯДОК ----------
    // Порядок берём из хранилища, а не из DOM. Хранилище пополняется в
    // порядке «сначала локальный, потом кто подключился», и в режиме
    // `grid` DOM повторяет его один в один. По DOM не выйдет: в
    // фокусном режиме крупная плитка стоит первой, и тогда
    //   - снятие закрепления ничего бы не меняло — фокус остался бы
    //     ровно на той плитке, с которой его только что сняли;
    //   - в режиме презентации фокус не уезжал бы на того, кто начал
    //     показывать экран, если тот лежит в полосе, а не в списке.
    // Разошлись с DOM (хранилище пустое или не то) — берём DOM
    const stored = Array.from(form.store?.getAll() || []).map(item => String(item.id));
    const identities = stored.filter(identity => rendered.includes(identity));
    const ordered = identities.length > 0 ? identities : rendered;
    // ---------- ПОРЯДОК ----------

    // Демонстрации собираем отдельно: трансляции тоже умеют отдавать
    // экран, а локального участника у них нет, поэтому смотрим на сам
    // объект participant из хранилища
    const sharing = ordered.filter(identity =>
        form.store?.get(identity)?.participant?.isScreenShareEnabled === true);

    // Приоритет: принудительный фокус организатора → личное
    // закрепление → демонстрация (в режиме презентации) → первый.
    // Закрепление в `room.metadata` само по себе не пишется — это личный
    // выбор одного человека; навязать крупным кого-то у
    // всех может только организатор и только себя
    return pickFocus({
        forced: form.forcedFocus,
        pinned: form.pinnedIdentity,
        layout,
        ordered,
        sharing
    });

}
