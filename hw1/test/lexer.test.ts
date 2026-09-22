import { describe, it, expect, beforeEach } from "vitest";
import { LexerEngine } from "../src/LexerEngine.js";
import { TokenType } from "../src/Types/TokenType.js";


describe("LexerEngine - Funny Language Spec", () => {
    let lexer: LexerEngine;

    // Полный ASCII алфавит (от ' ' [32] до '~' [126]) + \t, \r, \n
    const asciiAlphabet = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i))
        .concat(["\t", "\r", "\n"]);

    beforeEach(() => {
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
        lexer = new LexerEngine(rules, asciiAlphabet, skipTokens);
    });

    describe("1. Пустая строка и пробелы/комментарии (Skip)", () => {
        it("должен возвращать пустой массив для пустой строки", () => {
            expect(lexer.tokenize("")).toEqual([]);
        });

        it("должен полностью пропускать строки только из пробелов, табов и CRLF", () => {
            const input = "  \t \r\n \n \t ";
            expect(lexer.tokenize(input)).toEqual([]);
        });

        it("должен пропускать комментарии // до конца строки", () => {
            const input = "x = 1; // comment\ny = 2;";
            const tokens = lexer.tokenize(input);

            expect(tokens.map(t => t.value)).toEqual(["x", "=", "1", ";", "y", "=", "2", ";"]);
            expect(tokens.map(t => t.type)).toEqual([
                TokenType.IDENT, TokenType.OPERATOR, TokenType.INT, TokenType.OPERATOR,
                TokenType.IDENT, TokenType.OPERATOR, TokenType.INT, TokenType.OPERATOR
            ]);
        });
    });

    describe("2. Целые числа (INT: 0 | [1-9][0-9]*)", () => {
        it("должен корректно парсить 0 и обычные числа", () => {
            const tokens = lexer.tokenize("0 42 100500");

            expect(tokens.map(t => t.value)).toEqual(["0", "42", "100500"]);
            expect(tokens.every(t => t.type === TokenType.INT)).toBe(true);
        });

        it("разбор '00' и '01' (0 не объединяется с последующими цифрами)", () => {
            // '00' должно распарситься как два токена INT("0") и INT("0")
            const tokens00 = lexer.tokenize("00");
            expect(tokens00.map(t => t.value)).toEqual(["0", "0"]);

            // '01' должно распарситься как INT("0") и INT("1")
            const tokens01 = lexer.tokenize("01");
            expect(tokens01.map(t => t.value)).toEqual(["0", "1"]);
        });
    });

    describe("3. Идентификаторы с подчёркиваниями", () => {
        it("должен парсить идентификаторы с '_'", () => {
            const input = "_var my_var_123 _1_2_3_ _";
            const tokens = lexer.tokenize(input);

            expect(tokens.map(t => t.value)).toEqual(["_var", "my_var_123", "_1_2_3_", "_"]);
            expect(tokens.every(t => t.type === TokenType.IDENT)).toBe(true);
        });
    });

    describe("4. Ключевые слова и Longest Match / Priority", () => {
        it("должен распознавать все ключевые слова языка Funny", () => {
            const input = "function returns while if else assert assume invariant length";
            const tokens = lexer.tokenize(input);

            expect(tokens.every(t => t.type === TokenType.KEYWORD)).toBe(true);
        });

        it("Longest Match: 'function_name' или 'lengthy' должны быть IDENT, а не KEYWORD", () => {
            const tokens = lexer.tokenize("function_name lengthy");

            expect(tokens[0]!).toEqual({ type: TokenType.IDENT, value: "function_name", position: 0 });
            expect(tokens[1]!).toEqual({ type: TokenType.IDENT, value: "lengthy", position: 14 });
        });

        it("Priority: 'function' при равной длине с IDENT выбирает KEYWORD", () => {
            const tokens = lexer.tokenize("function");
            expect(tokens[0]!.type).toBe(TokenType.KEYWORD);
        });
    });
    it("разбор '00' и '01' (0 не объединяется с последующими цифрами)", () => {
        // '00' должно распарситься как два токена INT("0") и INT("0")
        const tokens00 = lexer.tokenize("00");
        expect(tokens00.map(t => t.value)).toEqual(["0", "0"]);

        // '01' должно распарситься как INT("0") и INT("1")
        const tokens01 = lexer.tokenize("01");
        expect(tokens01.map(t => t.value)).toEqual(["0", "1"]);
    });
    describe("5. Границы, операторы и разделители", () => {
        it("должен корректно токенизировать все операторы Funny", () => {
            const input = "()[]{},; + - * / == != <= >= < > = : => | not and or";
            const tokens = lexer.tokenize(input);
            
            //console.log(tokens);
            expect(tokens.every(t => t.type === TokenType.OPERATOR)).toBe(true);
            
        });

        it("Longest Match для составных операторов (== vs =, <= vs <, => vs =)", () => {
            const tokens = lexer.tokenize("a == b => c <= d");

            expect(tokens.map(t => t.value)).toEqual(["a", "==", "b", "=>", "c", "<=", "d"]);
            expect(tokens[1]!.type).toBe(TokenType.OPERATOR);
            expect(tokens[3]!.type).toBe(TokenType.OPERATOR);
            expect(tokens[5]!.type).toBe(TokenType.OPERATOR);
        });

        it("разбор обращения к массиву и вызова функции", () => {
            const input = "a[i] = length(arr);";
            const tokens = lexer.tokenize(input);

            expect(tokens.map(t => t.value)).toEqual([
                "a", "[", "i", "]", "=", "length", "(", "arr", ")", ";"
            ]);
        });
    });

    describe("6. Обработка невалидных символов и выход за ASCII (TRAP)", () => {
        it("должен выбрасывать ошибку на символах ASCII, непокрытых правилами", () => {
            // Символы '@' и '#' есть в ASCII, но отсутствуют в грамматике
            expect(() => lexer.tokenize("int x = @10;")).toThrowError(
                /Lexical error: unexpected character '@' at position 8/
            );
            expect(() => lexer.tokenize("#bad")).toThrowError(
                /Lexical error: unexpected character '#' at position 0/
            );
        });

        it("должен попадать в ловушку/ошибку на non-ASCII символах (кириллица, эмодзи)", () => {
            expect(() => lexer.tokenize("int переменная = 5;")).toThrowError(
                /Lexical error: unexpected character 'п' at position 4/
            );
            expect(() => lexer.tokenize("var 😊 = 1;")).toThrowError(
                /Lexical error: unexpected character '😊' at position 4/
            );
        });
    });

    describe("7. Экспорт таблицы переходов (Transition Table Export)", () => {
        it("должен экспортировать валидную таблицу с состояниями и TRAP_ID (-1)", () => {
            const table = lexer.exportTransitionTable();

            expect(table.startState).toBe(0);
            expect(table.trapState).toBe(-1);
            expect(table.transitions).toBeDefined();

            // Проверяем, что невалидный символ '@' или 'Non-ASCII' ведёт в TRAP (-1)
            const startTransitions = table.transitions[0]!;
            expect(startTransitions["@"]).toBe(-1);
        });
    });
});