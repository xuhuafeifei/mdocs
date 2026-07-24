import type { LanguageInput } from "shiki/types";

/**
 * Shiki language whitelist for mdocs web build.
 * Keep in sync with @fgbg/lobe-editor `supported-shiki-languages.ts`.
 */
export type SupportedLanguageInfo = {
  aliases?: string[];
  id: string;
  import: () => Promise<LanguageInput>;
  name: string;
};

export const supportedLanguagesInfo: SupportedLanguageInfo[] = [
  { id: "markdown", name: "Markdown", aliases: ["md"], import: () => import("@shikijs/langs/markdown") },
  { id: "mdx", name: "MDX", import: () => import("@shikijs/langs/mdx") },
  {
    id: "javascript",
    name: "JavaScript",
    aliases: ["js", "cjs", "mjs"],
    import: () => import("@shikijs/langs/javascript"),
  },
  {
    id: "typescript",
    name: "TypeScript",
    aliases: ["ts", "cts", "mts"],
    import: () => import("@shikijs/langs/typescript"),
  },
  { id: "jsx", name: "JSX", import: () => import("@shikijs/langs/jsx") },
  { id: "tsx", name: "TSX", import: () => import("@shikijs/langs/tsx") },
  { id: "html", name: "HTML", import: () => import("@shikijs/langs/html") },
  { id: "css", name: "CSS", import: () => import("@shikijs/langs/css") },
  { id: "scss", name: "SCSS", import: () => import("@shikijs/langs/scss") },
  { id: "less", name: "Less", import: () => import("@shikijs/langs/less") },
  { id: "vue", name: "Vue", import: () => import("@shikijs/langs/vue") },
  { id: "svelte", name: "Svelte", import: () => import("@shikijs/langs/svelte") },
  { id: "json", name: "JSON", import: () => import("@shikijs/langs/json") },
  { id: "jsonc", name: "JSON with Comments", import: () => import("@shikijs/langs/jsonc") },
  { id: "yaml", name: "YAML", aliases: ["yml"], import: () => import("@shikijs/langs/yaml") },
  { id: "toml", name: "TOML", import: () => import("@shikijs/langs/toml") },
  { id: "xml", name: "XML", import: () => import("@shikijs/langs/xml") },
  { id: "ini", name: "INI", aliases: ["properties"], import: () => import("@shikijs/langs/ini") },
  { id: "python", name: "Python", aliases: ["py"], import: () => import("@shikijs/langs/python") },
  { id: "java", name: "Java", import: () => import("@shikijs/langs/java") },
  { id: "kotlin", name: "Kotlin", aliases: ["kt", "kts"], import: () => import("@shikijs/langs/kotlin") },
  { id: "go", name: "Go", import: () => import("@shikijs/langs/go") },
  { id: "rust", name: "Rust", aliases: ["rs"], import: () => import("@shikijs/langs/rust") },
  { id: "c", name: "C", import: () => import("@shikijs/langs/c") },
  { id: "cpp", name: "C++", aliases: ["c++"], import: () => import("@shikijs/langs/cpp") },
  {
    id: "csharp",
    name: "C#",
    aliases: ["c#", "cs"],
    import: () => import("@shikijs/langs/csharp"),
  },
  { id: "ruby", name: "Ruby", aliases: ["rb"], import: () => import("@shikijs/langs/ruby") },
  { id: "php", name: "PHP", import: () => import("@shikijs/langs/php") },
  { id: "swift", name: "Swift", import: () => import("@shikijs/langs/swift") },
  { id: "lua", name: "Lua", import: () => import("@shikijs/langs/lua") },
  {
    id: "shellscript",
    name: "Shell",
    aliases: ["bash", "sh", "shell", "zsh"],
    import: () => import("@shikijs/langs/shellscript"),
  },
  {
    id: "shellsession",
    name: "Shell Session",
    aliases: ["console"],
    import: () => import("@shikijs/langs/shellsession"),
  },
  {
    id: "powershell",
    name: "PowerShell",
    aliases: ["ps", "ps1"],
    import: () => import("@shikijs/langs/powershell"),
  },
  {
    id: "docker",
    name: "Dockerfile",
    aliases: ["dockerfile"],
    import: () => import("@shikijs/langs/docker"),
  },
  { id: "nginx", name: "Nginx", import: () => import("@shikijs/langs/nginx") },
  { id: "make", name: "Makefile", aliases: ["makefile"], import: () => import("@shikijs/langs/make") },
  { id: "cmake", name: "CMake", import: () => import("@shikijs/langs/cmake") },
  { id: "sql", name: "SQL", import: () => import("@shikijs/langs/sql") },
  { id: "graphql", name: "GraphQL", aliases: ["gql"], import: () => import("@shikijs/langs/graphql") },
  { id: "diff", name: "Diff", import: () => import("@shikijs/langs/diff") },
  {
    id: "proto",
    name: "Protocol Buffer 3",
    aliases: ["protobuf"],
    import: () => import("@shikijs/langs/proto"),
  },
  { id: "wasm", name: "WebAssembly", import: () => import("@shikijs/langs/wasm") },
];

export const bundledLanguagesInfo = supportedLanguagesInfo;

const bundledLanguagesBase = Object.fromEntries(
  supportedLanguagesInfo.map((item) => [item.id, item.import]),
);

const bundledLanguagesAlias = Object.fromEntries(
  supportedLanguagesInfo.flatMap((item) => item.aliases?.map((alias) => [alias, item.import]) ?? []),
);

export const bundledLanguages = {
  ...bundledLanguagesBase,
  ...bundledLanguagesAlias,
};

export const bundledLanguagesBaseExport = bundledLanguagesBase;
