import { SubsetConstruction } from "./DFA/SubsetConstruction.js";
import { LexerEngine } from "./LexerEngine.js";
import type { NFAFragment } from "./NFA/NFAFragment.js";
import { RegexParser } from "./RegexParser/RegexParser.js";
import { TokenType } from "./Types/TokenType.js";

const alphabet = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789=<>_+ \t\n\r();/,".split("");

    const asciiAlphabet = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i))
        .concat(["\t", "\r", "\n"]);

    const rules = new Map<TokenType, string>([
        [
            TokenType.KEYWORD,
            "function|returns|requires|ensures|uses|while|if|else|true|false|assert|assume|invariant|length|forall|exists|int"
        ],
        [
            TokenType.OPERATOR,
            "==|!=|<=|>=|=>|not|and|or|<|>|=|,|;|:|\\+|\\-|\\*|/|\\(|\\)|\\[|\\]|\\{|\\}|\\|"
        ],
        [TokenType.IDENT, "[A-Za-z_][A-Za-z0-9_]*"],
        [TokenType.INT, "0|[1-9][0-9]*"],
        [TokenType.COMMENT, "//[^\n]*"],
        [TokenType.WS, "[ \t\r\n]+"]
    ]);

const skipTokens = new Set([TokenType.COMMENT, TokenType.WS])

const lexer = new LexerEngine(rules, asciiAlphabet, skipTokens);
const tokens = lexer.tokenize("function add(x) , returns int;");
console.log(tokens);

// for (let i = 0; i < 256; i++){
//     console.log(String.fromCodePoint(i));
// }

//console.log(dfa);
//console.log("Переходы из старта ДКА:", Array.from(dfa.transitions.keys()));
//console.log("Переходы 0:", Array.from(dfa.transitions.values()));