import { LexerEngine } from "../../lexer/src/LexerEngine.js";
import { TokenType } from "../../lexer/src/Types/TokenType.js";
import { Parser } from "./ast/FunnyParser.js";
import { inspect } from "node:util";

const asciiAlphabet = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i))
    .concat(["\t", "\r", "\n"]);

const rules = new Map<TokenType, string>([
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

const skipTokens = new Set([TokenType.COMMENT, TokenType.WS]);

const lexer = new LexerEngine(rules, asciiAlphabet, skipTokens);

const code = "main() returns r:int {r = 1 + 2 * 3;}";
const tokens = lexer.tokenize(code);

const funnyParser = new Parser(tokens)

const ast = funnyParser.parse();

console.log(inspect(ast, { depth: null, colors: true }));

