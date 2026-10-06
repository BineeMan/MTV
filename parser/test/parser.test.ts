import { describe, it, expect } from "vitest";

import { LexerEngine } from "../../lexer/src/LexerEngine.js";
import { FunnyParser, type AssignmentStmtNode, type FunctionCallNode } from "../src/Ast/FunnyParser.js";
import { TokenType } from "../../lexer/src/Types/TokenType.js";
import { ParseError } from "../src/Errors/Errors.js";

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

// Хелпер для прогона исходника через Лексер + Парсер
function parse(source: string) {
    const tokens = lexer.tokenize(source);
    const parser = new FunnyParser(tokens);
    return parser.parse();
}


// 1. ПОЗИТИВНЫЕ ТЕСТЫ
describe("Parser - Positive Scenarios", () => {

    it("1.1 Минимальная корректная функция без параметров", () => {
        const code = `main() returns r: int { r = 0; }`;
        const ast = parse(code);

        expect(ast.functions).toHaveLength(1);
        expect(ast.functions[0]!.name).toBe("main");
        expect(ast.functions[0]!.params).toEqual([]);
        expect(ast.functions[0]!.returns).toEqual([{ name: "r", varType: "int" }]);
    });

    it("1.2 Функция с контрактами (requires, ensures), локальными переменными и циклом с инвариантом", () => {
        const code = `
            sum(a: int[], n: int)
            requires n >= 0
            returns res: int
            ensures res >= 0
            uses i: int, s: int
            {
                i = 0;
                s = 0;
                while (i < n)
                invariant i <= n and s >= 0
                {
                    s = s + a[i];
                    i = i + 1;
                }
                res = s;
            }
        `;
        const ast = parse(code);
        const fn = ast.functions[0];

        expect(fn!.name).toBe("sum");
        expect(fn!.params).toHaveLength(2);
        expect(fn!.requires).toBeDefined();
        expect(fn!.ensures).toBeDefined();
        expect(fn!.uses).toHaveLength(2);
        expect(fn!.body.type).toBe("BlockStmt");
    });

    it("1.3 Объявление формулы с квантором forall и импликацией ->", () => {
        const code = `
            isSorted(a: int[], n: int) =>
                forall(i: int | i >= 0 and i < n - 1 -> a[i] <= a[i + 1])
        `;
        const ast = parse(code);

        expect(ast.formulas).toHaveLength(1);
        const formula = ast.formulas[0];
        expect(formula!.name).toBe("isSorted");
        expect(formula!.body.type).toBe("Quantifier");
    });

    it("1.4 Корректность обессахаривания многомерного массива (a[i][j] = v)", () => {
        const code = `
            updateMatrix() returns a: int[] {
                a[i][j] = 10;
            }
        `;
        const ast = parse(code);
        const fn = ast.functions[0];
        const stmt = (fn!.body as any).statements[0] as AssignmentStmtNode;

        // a[i][j] = 10 должно превратиться в: a = set(a, i, set(a[i], j, 10))
        expect(stmt.targets).toEqual(["a"]);
        expect(stmt.value.type).toBe("FunctionCall");

        const outerSet = stmt.value as FunctionCallNode;
        expect(outerSet.name).toBe("set");
        expect(outerSet.args[2]!.type).toBe("FunctionCall"); // Вложенный set
    });

    it("1.5 Кортежное присваивание (множественные цели)", () => {
        const code = `
            swap() returns x: int, y: int {
                x, y = getTuple();
            }
        `;
        const ast = parse(code);
        const stmt = (ast.functions[0]!.body as any).statements[0] as AssignmentStmtNode;

        expect(stmt.targets).toEqual(["x", "y"]);
        expect(stmt.value.type).toBe("FunctionCall");
    });

    it("1.6 Эталонное сравнение AST со Snapshot (Снимок)", () => {
        const code = `
            abs(x: int) returns r: int {
                if (x < 0) {
                    r = -x;
                } else {
                    r = x;
                }
            }
        `;
        const ast = parse(code);
        
        // Vitest автоматически сохранит и проверит структуру AST
        expect(ast).toMatchSnapshot();
    });
});

// 2. НЕГАТИВНЫЕ ТЕСТЫ
describe("Parser - Negative Scenarios & Edge Cases", () => {

    it("2.1 Пустой ввод (должен возвращать пустой модуль, а не падать)", () => {
        const ast = parse("");
        expect(ast.functions).toHaveLength(0);
        expect(ast.formulas).toHaveLength(0);
    });

    it("2.2 Незакрытая круглая скобка в аргументах функции", () => {
        const code = `foo(x: int returns r: int { r = 1; }`;
        
        expect(() => parse(code)).toThrowError(ParseError);
    });

    it("2.3 Незакрытая фигурная скобка в теле функции", () => {
        const code = `main() returns r: int { r = 1;`;

        expect(() => parse(code)).toThrowError(ParseError);
    });

    it("2.4 Лишние / неожиданные токены в конце файла", () => {
        const code = `
            main() returns r: int { r = 1; }
            unexpected_garbage_here + 123
        `;

        expect(() => parse(code)).toThrowError(ParseError);
    });

    it("2.5 Некорректный бинарный оператор или пропущенный операнд", () => {
        const code = `
            calc() returns r: int {
                r = 1 + ;
            }
        `;

        expect(() => parse(code)).toThrowError(ParseError);
    });

    it("2.6 Отсутствие двоеточия при объявлении типа переменной", () => {
        const code = `main(x int) returns r: int { r = x; }`;

        expect(() => parse(code)).toThrowError(ParseError);
    });

    // 3. ПРОВЕРКА НА ОТСУТСТВИЕ ЗАЦИКЛИВАНИЙ
    it("3.1 Непредвиденный конец файла (EOF) во время цикла while не вызывает бесконечный цикл", () => {
        const code = `main() returns r: int { while (true) {`;

        // Тест упадет по таймауту, если парсер зациклится
        expect(() => parse(code)).toThrowError(ParseError);
    }, 1000); // Таймаут 1 секунда

    it("3.2 Незавершенный квантор не вызывает бесконечный цикл", () => {
        const code = `f() => forall(x: int | `;

        expect(() => parse(code)).toThrowError(ParseError);
    }, 1000);
});