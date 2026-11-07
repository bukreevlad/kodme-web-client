#!/usr/bin/env bun

import path from "path";
import { existsSync, mkdirSync, statSync, rmSync } from 'fs';
import JavaScriptObfuscator from 'javascript-obfuscator';

/**
 * ***************************************************************************
 * Скрипт автоматизированной сборки проекта "Код.me"
 * ***************************************************************************
 */

/**
 * ***************************************************************************
 * Список файлов каталога (рекурсивно).
 * @param {string} dir - Каталог.
 * @returns {string[]} - Абсолютные пути файлов.
 * ***************************************************************************
 */
function listFiles(dir) {
    const glob = new Bun.Glob('**/*');
    const files = [];
    for (const file of glob.scanSync(dir)) {
        const fullPath = path.join(dir, file);
        if (statSync(fullPath).isFile()) files.push(fullPath);
    }
    return files;
}

/**
 * ***************************************************************************
 * Накатывает собранную статику из srcDir в рабочий каталог dstDir без простоя.
 * Сначала копируются все файлы, кроме index.html (старый index продолжает
 * ссылаться на ещё не удалённые файлы старой сборки), затем заменяется
 * index.html — точка переключения версии — и удаляются устаревшие файлы.
 * Каталог dstDir не заменяется целиком: он смонтирован в контейнеры
 * (bind mount держит inode каталога).
 * @param {string} srcDir - Каталог новой сборки.
 * @param {string} dstDir - Рабочий каталог раздачи.
 * ***************************************************************************
 */
async function syncDist(srcDir, dstDir) {
    const srcFiles = listFiles(srcDir);
    const relFiles = srcFiles.map((file) => path.relative(srcDir, file));

    // Копируем всё, кроме index.html
    for (let i = 0; i < srcFiles.length; i++) {
        if (relFiles[i] === 'index.html') continue;
        await Bun.write(path.join(dstDir, relFiles[i]), Bun.file(srcFiles[i]));
    }

    // Заменяем index.html последним: старые хешированные файлы ещё на месте
    await Bun.write(path.join(dstDir, 'index.html'), Bun.file(path.join(srcDir, 'index.html')));

    // Удаляем устаревшие файлы, которых нет в новой сборке
    const keep = new Set(relFiles);
    for (const file of listFiles(dstDir)) {
        const rel = path.relative(dstDir, file);
        if (!keep.has(rel)) rmSync(file);
    }
}

// Проверяем, передан ли флаг безопасности при запуске скрипта
const isSecureBuild = Bun.argv.includes('--secure');
console.log(`🚀 Начинаем сборку проекта${isSecureBuild ? ' [РЕЖИМ ОБФУСКАЦИИ]' : ''}...`);

// ***************************************************************************
// 1. ПОДГОТОВКА КАТАЛОГА СБОРКИ (dist.new)
// ***************************************************************************
// Сборка идёт в dist.new, а в рабочий dist результат накатывается в самом
// конце (шаг 8): во время пересборки старые хешированные файлы не исчезают,
// nginx не отдаёт 404 и установка Service Worker не проваливается.
console.log('1. 🧹 Готовим каталог сборки dist.new...');
if (existsSync('./dist.new')) {
    await Bun.$`rm -rf ./dist.new`.quiet();
}
mkdirSync('./dist.new', { recursive: true });
if (!existsSync('./dist')) {
    mkdirSync('./dist', { recursive: true });
}
console.log('   ✅ Каталог сборки dist.new готов');

// ***************************************************************************
// 2. СБОРКА JAVASCRIPT
// ***************************************************************************
console.log('2. 📦 Собираем JavaScript...');
const buildResult = await Bun.build({
    entrypoints: ['./js/main.js'],
    outdir: './dist.new/assets', // Хешированные артефакты сборки (кэшируются жёстко)
    target: 'browser',
    minify: true,
    // Ленивые import() (локали en) идут отдельными чанками, а не в main:
    // чанки кэширует SW (манифест собирается find'ом по каталогу)
    splitting: true,
    naming: '[name].[hash].js' // Генерирует уникальный хеш для кэш-бастинга
});

if (!buildResult.success) {
    console.error('   ❌ Ошибка сборки JavaScript!', buildResult.logs);
    process.exit(1);
}

// Среди артефактов есть чанки (splitting) — точка входа помечена kind'ом
const mainArtifact = buildResult.outputs.find(o => o.kind === "entry-point");
if (!mainArtifact) {
    console.error('   ❌ Не найден артефакт точки входа main.js!');
    process.exit(1);
}

const hashedJsFile = mainArtifact.path;
const hashedJsFileName = path.basename(hashedJsFile);

// Читаем собранный файл для последующих инъекций
let mainJsContent = await Bun.file(hashedJsFile).text();
mainJsContent = mainJsContent.replace(/__BUILD_VERSION__/g, mainArtifact.hash || "prod");
mainJsContent = mainJsContent.replace(/__BUILD_AT__/g, new Date().toISOString());

console.log(`   ✅ JS собран: ${hashedJsFileName}`);

// ***************************************************************************
// 2.1 СБОРКА BOT APP SDK (отдельный бандл, классический скрипт)
// ***************************************************************************
console.log('2.1 📦 Собираем bot-app-sdk...');
const sdkBuildResult = await Bun.build({
    entrypoints: ['./js/bot-app-sdk.ts'],
    outdir: './dist.new',
    target: 'browser',
    minify: false,
    naming: 'bot-app-sdk.js', // Стабильное публичное имя: боты грузят SDK по прямой ссылке
    format: 'iife' // Классический скрипт без import/export — выставляет window.WebApp
});

if (!sdkBuildResult.success) {
    console.error('   ❌ Ошибка сборки bot-app-sdk!', sdkBuildResult.logs);
    process.exit(1);
}

console.log('   ✅ bot-app-sdk собран: bot-app-sdk.js');

// ***************************************************************************
// 3. СБОРКА CSS (Tailwind v4 + Хеширование)
// ***************************************************************************
console.log('3. 🎨 Собираем и хешируем Tailwind v4 CSS...');

// Сначала собираем временный базовый файл во временную директорию (или прямо в assets)
const tempCssPath = './dist.new/assets/temp.main.css';
mkdirSync('./dist.new/assets', { recursive: true });

// Вызываем официальный компилятор Tailwind v4
const tailwindResult = Bun.spawnSync([
    "bunx",
    "@tailwindcss/cli",
    "-i", "./css/main.css",    // Ваш исходный файл со `@import "tailwindcss";`
    "-o", tempCssPath,         // Временный выходной файл
    "--minify"                 // Встроенная минификация от Lightning CSS
],
    {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
    },);

if (!tailwindResult.success) {
    console.error('   ❌ Ошибка компиляции Tailwind v4 CSS!', tailwindResult.stderr.toString());
    process.exit(1);
}

// Читаем скомпилированный контент, чтобы сгенерировать уникальный хеш на основе содержимого
const cssContent = await Bun.file(tempCssPath).text();
const cssHash = Bun.hash(cssContent).toString(16).substring(0, 8); // 8-значный хеш
const hashedCssFileName = `main.${cssHash}.css`;
const finalCssPath = `./dist.new/assets/${hashedCssFileName}`;

// Записываем финальный хешированный файл, а временный удаляем
await Bun.write(finalCssPath, cssContent);
await Bun.$`rm ${tempCssPath}`.quiet();

console.log(`   ✅ CSS собран с Tailwind v4: css/${hashedCssFileName}`);

// ***************************************************************************
// 4. КОПИРОВАНИЕ СТАТИКИ И ВОРКЕРОВ
// ***************************************************************************
console.log('4. 📁 Копируем статику и воркеры...');

// Monaco Editor Workers (используем нативный Glob для Bun)
const workersDist = './dist.new/monaco-workers';
if (!existsSync(workersDist)) mkdirSync(workersDist, { recursive: true });
const assetsPath = 'node_modules/monaco-editor/min/vs/assets';
if (existsSync(assetsPath)) {
    const scanner = new Bun.Glob('*.worker-*.js');
    for (const file of scanner.scanSync(assetsPath)) {
        await Bun.write(path.join(workersDist, file), Bun.file(path.join(assetsPath, file)));
    }
}

// Opus Recorder
if (existsSync('node_modules/opus-recorder/dist/encoderWorker.min.js')) {
    await Bun.write('./dist.new/encoderWorker.min.js', Bun.file('node_modules/opus-recorder/dist/encoderWorker.min.js'));
}

// Ресурсные папки
const folders = ['img', 'locales', 'fonts'];
for (const folder of folders) {
    if (existsSync(folder)) {
        await Bun.$`cp -r ${folder} dist.new/`.quiet();
    }
}

// Манифест приложения
if (existsSync("site.webmanifest")) {
    await Bun.write("./dist.new/site.webmanifest", Bun.file("site.webmanifest"));
}

// ***************************************************************************
// 5. ГЕНЕРАЦИЯ СПИСКА ФАЙЛОВ (Для Service Worker)
// ***************************************************************************
console.log('5. 📝 Подготовка списка файлов для кэша...');
const findResult = await Bun.$`find dist.new -type f`.text();
let filesToCache = findResult.trim().split('\n')
    .filter(f => f && !f.includes('.map') && !f.includes('css/custom-theme.css'))
    .map(f => f.replace('dist.new/', '/'));

filesToCache.unshift('/'); // Добавляем корень

// Генерируем хеш на основе контента всех имен файлов, чтобы CACHE_NAME менялся
const manifestString = JSON.stringify(filesToCache);
const cacheHash = Bun.hash(manifestString).toString(16).substring(0, 8);
const cacheName = `codeme::app::${cacheHash}`;

console.log(`   ✅ Подготовлено файлов: ${filesToCache.length}`);

// ***************************************************************************
// 6. ОБРАБОТКА SERVICE WORKER И ОБНОВЛЕНИЕ MAIN.JS
// ***************************************************************************
console.log('6. ⚙️  Обрабатываем Service Worker...');
const swSrcPath = "./js/sw.ts";

if (existsSync(swSrcPath)) {

    // Компилируем TS-шаблон в JS: без минификации, чтобы токены сборки
    // __CACHE_NAME__ и __CACHE_FILES_ARRAY__ остались в тексте бандла
    const swBuildResult = await Bun.build({
        entrypoints: [swSrcPath],
        outdir: './dist.new',
        target: 'browser',
        minify: false,
        naming: 'sw.js'
    });

    if (!swBuildResult.success) {
        console.error('   ❌ Ошибка сборки Service Worker!', swBuildResult.logs);
        process.exit(1);
    }

    // Инъекция переменных в код Service Worker
    let swContent = await Bun.file('./dist.new/sw.js').text();
    swContent = swContent
        .replace(/__CACHE_NAME__/g, cacheName)
        .replace(/__CACHE_FILES_ARRAY__/g, manifestString);

    // Хешируем итоговый SW
    const swFileName = `sw.js`;

    await Bun.write(`./dist.new/${swFileName}`, swContent);
    console.log(`   ✅ SW записан: ${swFileName}`);

    // Прописываем актуальное имя SW в основной JS файл
    console.log('   🔧 Обновляем регистрацию SW в main.js...');
    mainJsContent = mainJsContent.replace(/"sw\.js"|'sw\.js'|"__SW_FILE_NAME__"|'__SW_FILE_NAME__'|__SW_FILE_NAME__/g, `"${swFileName}"`);
}

// ***************************************************************************
// 6.1 БЛОК ОБФУСКАЦИИ (Выполняется по условию)
// ***************************************************************************
if (isSecureBuild) {
    console.log('   🔒 Обфусцируем финальный main.js...');
    try {
        // Читаем файл настроек обфускатора
        const obfuscatorConfigPath = './obfuscator.json';
        let obfuscatorOptions = {};

        if (existsSync(obfuscatorConfigPath)) {
            obfuscatorOptions = await Bun.file(obfuscatorConfigPath).json();
        } else {
            console.warn('   ⚠️ Файл настроек обфускатора не найден, используем дефолтные настройки');
        }

        // Запускаем обфускацию контента и РАСКОММЕНТИРУЕМ логику:
        const obfuscationResult = JavaScriptObfuscator.obfuscate(mainJsContent, obfuscatorOptions);
        mainJsContent = obfuscationResult.getObfuscatedCode();
        console.log('   ✅ Обфускация успешно завершена');
    } catch (err) {
        console.error('   ❌ Ошибка при обфускации кода!', err);
        process.exit(1);
    }
} else {
    console.log('   ⏩ Пропускаем обфускацию (обычная сборка)...');
}

// Финальная запись исправленного (и при необходимости обфусцированного) main.js на диск
await Bun.write(hashedJsFile, mainJsContent);

// ***************************************************************************
// 7. ОБНОВЛЕНИЕ INDEX.HTML
// ***************************************************************************
console.log('7. 📄 Обновляем index.html...');
const indexPath = './index.html';
if (existsSync(indexPath)) {
    let htmlContent = await Bun.file(indexPath).text();

    // Замена CSS (ищет href="css/main.css" или "assets/main.[hash].css")
    if (hashedCssFileName) {
        htmlContent = htmlContent.replace(/href="(?:css|assets)\/main(\.[^"]+)?\.css"/g, `href="assets/${hashedCssFileName}"`);
    }

    // Замена или вставка JS
    const scriptTag = `<script type="module" src="assets/${hashedJsFileName}"></script>`;

    // Если тег <script> уже есть — обновляем src, если нет — вставляем перед </body>
    if (htmlContent.includes('<script')) {
        htmlContent = htmlContent.replace(/src="(.*)?main(\.[^"]+)?\.js"/g, `src="assets/${hashedJsFileName}"`);
    } else {
        htmlContent = htmlContent.replace('</body>', `${scriptTag}\n</body>`);
    }

    await Bun.write('./dist.new/index.html', htmlContent);
    console.log('   ✅ index.html успешно обновлен');
}

// ***************************************************************************
// 8. АТОМАРНОЕ НАКАТЫВАНИЕ В DIST
// ***************************************************************************
console.log('8. 🚀 Накатываем сборку в dist...');
await syncDist('./dist.new', './dist');
await Bun.$`rm -rf ./dist.new`.quiet();
console.log('   ✅ dist обновлён без простоя старой версии');

console.log('\n🎉 Сборка успешно завершена!');