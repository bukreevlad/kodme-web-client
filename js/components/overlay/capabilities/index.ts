// Импортируем capabilities
import { safeArea } from "./safe_area.js";
import { swipe } from "./swipe.js";
import { windowGeometry } from "./window_geometry.js";
import { popoverGeometry } from "./popover_geometry.js";

// Импортируем типы
import type { OverlayCapability, OverlayCapabilityName } from "../types.js";

/**
 * ***************************************************************************
 * Реестр капабилти контейнеров.
 * ***************************************************************************
 *
 * Капабилти — это необязательные куски поведения, которые нужны не всем типам
 * оверлеев. Базовый класс `Overlay` их не знает: он лишь получает список из
 * пресета и вызывает `init` / `afterOpen` / `destroy` в нужные моменты.
 *
 * Зачем так, а не флаги в опциях:
 * иначе у каждого вызывающего в опциях появляется половина ключей, которые для
 * его типа не делают ничего (`targetNode` у формы-экрана, `closeOnSwipe` у
 * модалки). Здесь опции достаются только тому, кому они положены.
 *
 * Интерфейс капабилти:
 * - `name`   — имя для пресета;
 * - `methods` — объект методов, которые копируются на экземпляр (необязательно);
 * - `init(form)`         — при открытии, после монтирования в DOM;
 * - `afterOpen(form)`    — после `onOpen` (необязательно);
 * - `destroy(form)`      — при закрытии.
 */
export const CAPABILITIES: Record<OverlayCapabilityName, OverlayCapability> = {
    safe_area: safeArea,
    swipe: swipe,
    window_geometry: windowGeometry,
    popover_geometry: popoverGeometry
};
