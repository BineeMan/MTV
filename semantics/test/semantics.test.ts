import { describe, it, expect } from 'vitest';

import { rulesFunny, asciiAlphabet, skipTokens } from '../../global/GlobalVars.js';
import { LexerEngine } from '../../lexer/src/LexerEngine.js';
import { FunnyParser } from '../../parser/src/Ast/FunnyParser.js';
import { SemanticAnalyzer } from '../src/semantic_check/SemanticAnalyzer.js';

const lexer = new LexerEngine(rulesFunny, asciiAlphabet, skipTokens);

function analyze(source: string) {
    const tokens = lexer.tokenize(source);
    const parser = new FunnyParser(tokens);
    const ast = parser.parse();
    
    const analyzer = new SemanticAnalyzer();
    const errors = analyzer.analyzeAndInferModule(ast);

    return { ast, errors };
}

describe('SemanticAnalyzer (HW3 - Funny Language)', () => {

    describe('1. Позитивные тесты (Корректные типы и аннотация AST)', () => {
        it('должен проставлять inferredType для арифметики и локальных переменных', () => {
            const code = `
                main(a: int) returns r: int
                uses x
                {
                    x = a + 10;
                    r = x;
                }
            `;
            const { ast, errors } = analyze(code);

            expect(errors).toHaveLength(0);

            const fn = ast.functions[0]!;
            if (fn.body.type === 'BlockStmt') {
                const stmt1 = fn.body.statements[0]!;
                if (stmt1.type === 'AssignmentStmt') {
                    expect(stmt1.value.inferredType).toBe('int');
                }
            }
        });

        it('должен успешно выводить типы для работы с массивами и встроенной функцией length', () => {
            const code = `
                process(arr: int[]) returns len: int
                uses elem
                {
                    len = length(arr);
                    elem = arr[0];
                }
            `;
            const { ast, errors } = analyze(code);

            expect(errors).toHaveLength(0);

            const fn = ast.functions[0]!;
            const elemVar = fn.uses.find(u => u.name === 'elem');
            expect(elemVar?.inferredType).toBe('int');
        });
    });

    describe('2. Проверки области видимости и таблицы символов', () => {
        it('должен фиксировать ошибку при обращении к необъявленной переменной', () => {
            const code = `
                foo() returns r: int {
                    r = unknownVar + 1;
                }
            `;
            const { errors } = analyze(code);

            expect(errors).toHaveLength(1);
            expect(errors[0]?.message).toContain("Undeclared variable 'unknownVar'");
        });

        it('должен запрещать повторное объявление параметров с одинаковым именем', () => {
            const code = `
                dupParam(a: int, a: int) returns r: int {
                    r = a;
                }
            `;
            const { errors } = analyze(code);

            expect(errors.length).toBeGreaterThanOrEqual(1);
            expect(errors.some(e => e.message.includes("Redefinition"))).toBe(true);
        });

        it('должен запрещать присваивание в read-only параметры', () => {
            const code = `
                inc(p: int) returns r: int {
                    p = p + 1;
                    r = p;
                }
            `;
            const { errors } = analyze(code);

            expect(errors).toHaveLength(1);
            expect(errors[0]?.message).toContain("Cannot assign to read-only parameter 'p'");
        });
    });

    describe('3. Семантическая проверка типов', () => {
        it('должен фиксировать несоответствие типов при присваивании', () => {
            const code = `
                badAssign(arr: int[]) returns r: int {
                    r = arr;
                }
            `;
            const { errors } = analyze(code);

            expect(errors).toHaveLength(1);
            expect(errors[0]?.message).toContain("Type mismatch");
        });

        it('должен запрещать индексацию обычных целых чисел (не int[])', () => {
            const code = `
                notAnArray(num: int) returns r: int {
                    r = num[0];
                }
            `;
            const { errors } = analyze(code);

            expect(errors).toHaveLength(1);
            expect(errors[0]?.message).toContain("Array access target must be 'int[]'");
        });

        it('должен требовать тип int для индекса массива', () => {
            const code = `
                badIndex(arr: int[], idx: int[]) returns r: int {
                    r = arr[idx];
                }
            `;
            const { errors } = analyze(code);

            expect(errors).toHaveLength(1);
            expect(errors[0]?.message).toContain("Array index must be 'int'");
        });

        it('должен фиксировать ошибку типов в условии if (сравнение массива с числом)', () => {
            const code = `
                badIf(arr: int[]) returns r: int {
                    if (arr > 0) {
                        r = 1;
                    }
                }
            `;
            const { errors } = analyze(code);

            expect(errors.length).toBeGreaterThanOrEqual(1);
            expect(errors.some(e => e.message.includes("must be int") || e.message.includes("is not int"))).toBe(true);
        });
    });

    describe('4. Вызовы функций и проверки сигнатур', () => {
        it('должен контролировать количество передаваемых аргументов', () => {
            const code = `
                add(a: int, b: int) returns r: int { r = a + b; }

                test() returns r: int {
                    r = add(1);
                }
            `;
            const { errors } = analyze(code);

            expect(errors).toHaveLength(1);
            expect(errors[0]?.message).toContain("expects 2 argument(s), but got 1");
        });

        it('должен проверять типы передаваемых аргументов', () => {
            const code = `
                add(a: int, b: int) returns r: int { r = a + b; }

                test(arr: int[]) returns r: int {
                    r = add(1, arr);
                }
            `;
            const { errors } = analyze(code);

            expect(errors).toHaveLength(1);
            expect(errors[0]?.message).toContain("Argument 2 of 'add' type mismatch");
        });

        it('должен проверять соответствие количества целей при кортежном присваивании', () => {
            const code = `
                pair() returns x: int, y: int { x = 1; y = 2; }

                test() returns r: int {
                    r = pair();
                }
            `;
            const { errors } = analyze(code);

            expect(errors).toHaveLength(1);
            expect(errors[0]?.message).toContain("returns 2 value(s), but 1 target(s) were assigned");
        });
    });

    describe('5. Бонус: Вывод типов локальных переменных без аннотаций', () => {
        it('должен успешно выводить тип локальной переменной по первому присваиванию', () => {
            const code = `
                inferTest(arr: int[]) returns r: int
                uses temp
                {
                    temp = arr;
                    r = length(temp);
                }
            `;
            const { ast, errors } = analyze(code);

            expect(errors).toHaveLength(0);

            const fn = ast.functions[0]!;
            const tempVar = fn.uses.find(u => u.name === 'temp');
            expect(tempVar?.inferredType).toBe('int[]');
        });

        it('должен сообщать об ошибке при противоречивых повторных присваиваниях', () => {
            const code = `
                conflictTest(arr: int[]) returns r: int
                uses temp
                {
                    temp = 10;
                    temp = arr;
                    r = temp;
                }
            `;
            const { errors } = analyze(code);

            expect(errors).toHaveLength(1);
            expect(errors[0]?.message).toContain("Type mismatch for target 'temp': expected 'int', got 'int[]'");
        });
    });

    describe('6. Наличие позиций и множественная диагностика', () => {
        it('не должен останавливаться после первой ошибки', () => {
            const code = `
                multiError(a: int) returns r: int 
                {
                    a = 10;
                    r = unknownVar;
                }
            `;
            const { errors } = analyze(code);

            expect(errors.length).toBeGreaterThanOrEqual(2);
        });

        it('каждая ошибка должна содержать корректную числовую позицию', () => {
            const code = `
                posTest() returns r: int {
                    r = unknownSym;
                }
            `;
            const { errors } = analyze(code);

            expect(errors).toHaveLength(1);
            expect(errors[0]).toHaveProperty('position');
            expect(typeof errors[0]?.position).toBe('number');
        });
    });
});