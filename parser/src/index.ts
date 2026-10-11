import { LexerEngine } from "../../lexer/src/LexerEngine.js";
import { TokenType } from "../../lexer/src/Types/TokenType.js";
import { FunnyParser } from "./Ast/FunnyParser.js";
import { inspect } from "node:util";
import { rulesFunny, asciiAlphabet } from "../../global/GlobalVars.js";

const skipTokens = new Set([TokenType.COMMENT, TokenType.WS]);

const lexer = new LexerEngine(rulesFunny, asciiAlphabet, skipTokens);

const code = "main() returns r:int {r = 1 + 2 * 3;}";
const tokens = lexer.tokenize(code);

const funnyParser = new FunnyParser(tokens)

const ast = funnyParser.parse();

console.log(inspect(ast, { depth: null, colors: true }));

