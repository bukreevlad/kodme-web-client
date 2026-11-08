// Конфигурация ESLint для web-client (flat config).
// Проект полностью на TypeScript: исходники — только .ts, поэтому
// запрещаем any и default-экспорты (default допустим лишь в конфигах
// и entry-точках — см. исключения ниже).
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import-x";

export default [
    {
        // Файлы TypeScript: правила проекта (any и default-экспорты запрещены)
        files: ["**/*.ts"],
        languageOptions: {
            parser: tsparser,
            parserOptions: {
                ecmaVersion: "latest",
                sourceType: "module"
            }
        },
        plugins: {
            "@typescript-eslint": tseslint,
            "import": importPlugin
        },
        rules: {
            // Запрет any во всех видах
            "@typescript-eslint/no-explicit-any": "error",
            // Named exports по умолчанию
            "import/no-default-export": "error",
            // window._lc удалён при переходе на i18next: строка — t(),
            // объект/массив — I18n.tree
            "no-restricted-syntax": ["error", {
                selector: "MemberExpression[property.name='_lc']",
                message: "window._lc удалён: строки берите через t() из js/utils/i18n, объекты и массивы — через I18n.tree."
            }]
        }
    },
    {
        // Исключения: конфиги и entry-точки (bun.build, eslint.config)
        // используют default-экспорт по канону — правило для них выключено
        files: [
            "bun.build.js",
            "bun.build.ts",
            "eslint.config.js",
            "**/*.config.ts",
            "**/*.config.js"
        ],
        rules: {
            "import/no-default-export": "off"
        }
    },
    {
        ignores: ["dist/**", "node_modules/**", "docs/**"]
    }
];
