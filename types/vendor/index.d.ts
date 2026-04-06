declare module "dictionary-en" {
  const dictionary: unknown;
  export default dictionary;
}

declare module "dictionary-en-au" {
  const dictionary: unknown;
  export default dictionary;
}

declare module "dictionary-en-gb" {
  const dictionary: unknown;
  export default dictionary;
}

declare module "nspell" {
  interface SpellChecker {
    correct(word: string): boolean;
    suggest(word: string): string[];
  }

  export default function nspell(dictionary: unknown): SpellChecker;
}
