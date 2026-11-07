/**
 * Универсальная пара «ключевые кадры + настройки» для `element.animate()`.
 */
export interface AnimationPreset {

    /** Ключевые кадры анимации. */
    animation: Keyframe[];

    /** Настройки проигрывания: длительность, easing, fill. */
    settings: KeyframeAnimationOptions;

}

/**
 * ***************************************************************************
 * Пресеты времени и функций сглаживания (Easing)
 *
 * Каждое значение проверяется через `satisfies KeyframeAnimationOptions`:
 * без него `fill: "forwards"` выводится как `string`, и пара перестаёт
 * совпадать с контрактом `element.animate()` (`FillMode` — union литералов).
 * ***************************************************************************
 */
export const timing = {
    fastOut: { duration: 150, easing: "ease-out", fill: "forwards" } satisfies KeyframeAnimationOptions,
    fastIn: { duration: 150, easing: "ease-in", fill: "forwards" } satisfies KeyframeAnimationOptions,
    normalOut: { duration: 250, easing: "ease-out", fill: "forwards" } satisfies KeyframeAnimationOptions,
    bouncy: { duration: 350, easing: "ease-out", fill: "forwards" } satisfies KeyframeAnimationOptions,
};

/**
 * ***************************************************************************
 * Универсальные ключевые кадры
 *
 * Проверка через `satisfies Keyframe[]` сохраняет совместимость с
 * `element.animate()` (числовые `opacity`/`offset` и строковые `transform`
 * входят в контракт `Keyframe`).
 * ***************************************************************************
 */
export const keyframes = {
    fadeIn: [
        { opacity: 0 },
        { opacity: 1 }
    ] satisfies Keyframe[],
    fadeOut: [
        { opacity: 1 },
        { opacity: 0 }
    ] satisfies Keyframe[],
    scaleUp: [
        { opacity: 0, transform: "scale(0.95)", offset: 0 },
        { opacity: 1, transform: "scale(1.02)", offset: 0.7 },
        { opacity: 1, transform: "scale(1)", offset: 1 }
    ] satisfies Keyframe[],
    scaleDown: [
        { opacity: 1, transform: "scale(1)" },
        { opacity: 0, transform: "scale(0.97)" }
    ] satisfies Keyframe[],
    slideInUp: [
        { opacity: 0, transform: "translateY(20px) scale(0.95)", offset: 0 },
        { opacity: 1, transform: "translateY(-4px) scale(1.02)", offset: 0.7 },
        { opacity: 1, transform: "translateY(0) scale(1)", offset: 1 }
    ] satisfies Keyframe[],
    slideOutDown: [
        { transform: "translateY(0) scale(1)" },
        { transform: "translateY(15px) scale(0.97)" }
    ] satisfies Keyframe[],
    slideInLeft: [
        { transform: "translateX(-100%)" },
        { transform: "translateX(0)" }
    ] satisfies Keyframe[],
    slideOutLeft: [
        { transform: "translateX(0)" },
        { transform: "translateX(-100%)" }
    ] satisfies Keyframe[],
    slideInRight: [
        { transform: "translateX(100%)" },
        { transform: "translateX(0%)" }
    ] satisfies Keyframe[],
    slideOutRight: [
        { transform: "translateX(0)" },
        { transform: "translateX(100%)" }
    ] satisfies Keyframe[],
};

/**
 * ***************************************************************************
 * Готовые универсальные анимации
 * ***************************************************************************
 */
export const fadeIn = { animation: keyframes.fadeIn, settings: timing.fastIn } satisfies AnimationPreset;
export const fadeOut = { animation: keyframes.fadeOut, settings: timing.fastIn } satisfies AnimationPreset;

export const scaleUp = { animation: keyframes.scaleUp, settings: timing.bouncy } satisfies AnimationPreset;
export const scaleDown = { animation: keyframes.scaleDown, settings: timing.fastIn } satisfies AnimationPreset;

export const slideInUp = { animation: keyframes.slideInUp, settings: timing.bouncy } satisfies AnimationPreset;
export const slideOutDown = { animation: keyframes.slideOutDown, settings: timing.fastIn } satisfies AnimationPreset;

export const slideInLeft = { animation: keyframes.slideInLeft, settings: timing.normalOut } satisfies AnimationPreset;
export const slideOutLeft = { animation: keyframes.slideOutLeft, settings: timing.fastIn } satisfies AnimationPreset;

export const slideInRight = { animation: keyframes.slideInRight, settings: timing.normalOut } satisfies AnimationPreset;
export const slideOutRight = { animation: keyframes.slideOutRight, settings: timing.fastIn } satisfies AnimationPreset;
