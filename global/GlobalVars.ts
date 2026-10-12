import { TokenType } from "../lexer/src/Types/TokenType.js";

export const asciiAlphabet = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i))
    .concat(["\t", "\r", "\n"]);

export const rulesFunny = new Map<TokenType, string>([
    [
        TokenType.KEYWORD,
        "function|returns|requires|ensures|uses|while|if|else|true|false|assert|assume|invariant|forall|exists|int"
    ],
    [
        TokenType.OPERATOR,
        "==|!=|<=|>=|=>|->|not|and|or|<|>|=|,|;|:|\\+|\\-|\\*|/|\\(|\\)|\\[|\\]|\\{|\\}|\\|"
    ],
    [TokenType.IDENT, "[A-Za-z_][A-Za-z0-9_]*"],
    [TokenType.INT, "0|[1-9][0-9]*"],
    [TokenType.COMMENT, "//[^\n]*"],
    [TokenType.WS, "[ \t\r\n]+"]
]);

export const skipTokens = new Set([TokenType.COMMENT, TokenType.WS]);