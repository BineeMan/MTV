import { SemanticCheckError } from "../../../Errors/Errors.js";
import type {
    AssignmentStmtNode,
    ExpressionNode,
    FormulaDeclNode,
    FunctionCallNode,
    FunctionDeclNode,
    LogicNode,
    ModuleNode,
    StatementNode,
    VarType
} from "../../../parser/src/Ast/AstNodes.js";
import type { SemanticError } from "./SemanticError.js";
import { SymbolTable } from "./SymbolTable.js";
import type { Symbol } from "./Symbols.js";

export class SemanticAnalyzer {
    private symbolTable = new SymbolTable();
    private errors: SemanticError[] = [];

    public analyzeAndInferModule(module: ModuleNode): SemanticError[] {
        this.errors.length = 0;
        this.symbolTable.clear();
        this.symbolTable.enterScope();

        this.registerBuiltins();

        // 1. Пасс 1: Регистрация всех функций и формул в глобальной области
        for (const fun of module.functions) {
            if (this.symbolTable.doesExist(fun.name)) {
                this.reportError(`Redefinition of symbol '${fun.name}'`, fun.position);
                continue;
            }
            this.symbolTable.define({
                name: fun.name,
                kind: "Function",
                position: fun.position,
                node: fun
            });
        }

        for (const formula of module.formulas) {
            if (this.symbolTable.doesExist(formula.name)) {
                this.reportError(`Redefinition of symbol '${formula.name}'`, formula.position);
                continue;
            }
            this.symbolTable.define({
                name: formula.name,
                kind: "Formula",
                position: formula.position,
                node: formula
            });
        }

        // 2. Пасс 2: Анализ формул
        for (const formula of module.formulas) {
            this.analyzeFormula(formula);
        }

        // 3. Пасс 3: Анализ функций
        for (const fun of module.functions) {
            this.analyzeFunction(fun);
        }

        return this.errors;
    }

    private registerBuiltins() {
        this.symbolTable.define({
            kind: 'Function',
            name: 'length',
            position: 0,
            node: {
                type: 'FunctionDecl',
                name: 'length',
                params: [{ type: 'VarDef', name: 'arr', varType: 'int[]', position: 0 }],
                returns: [{ type: 'VarDef', name: 'res', varType: 'int', position: 0 }],
                uses: [],
                body: {
                    type: 'BlockStmt',
                    statements: [],
                    position: 0
                },
                position: 0
            }
        });
    }

    private analyzeFormula(formula: FormulaDeclNode) {
        this.symbolTable.enterScope();

        for (const param of formula.params) {
            this.define({
                name: param.name,
                kind: "Parameter",
                position: param.position,
                node: param
            });
        }

        this.analyzeLogicNode(formula.body);
        if (formula.body.inferredType !== 'boolean' && formula.body.inferredType !== 'unknown') {
            this.reportError(`Formula '${formula.name}' body must be a boolean predicate`, formula.position);
        }

        this.symbolTable.exitScope();
    }

    private analyzeFunction(fun: FunctionDeclNode) {
        this.symbolTable.enterScope();

        // Параметры (Read-Only)
        for (const varDef of fun.params) {
            if (!varDef.varType) {
                this.reportError(`Parameter '${varDef.name}' must have an explicit type`, varDef.position);
            }
            this.define({
                name: varDef.name,
                kind: "Parameter",
                position: varDef.position,
                node: varDef
            });
        }

        // Переменные возврата (Read-Write)
        for (const varDef of fun.returns) {
            if (!varDef.varType) {
                this.reportError(`Return variable '${varDef.name}' must have an explicit type`, varDef.position);
            }
            this.define({
                name: varDef.name,
                kind: "ReturnVariable",
                position: varDef.position,
                node: varDef
            });
        }

        // Локальные переменные (uses) — тип может выводиться
        for (const varDef of fun.uses) {
            this.define({
                name: varDef.name,
                kind: "LocalVariable",
                position: varDef.position,
                node: varDef
            });
        }

        // Анализ requires (доступны только параметры)
        if (fun.requires) {
            this.analyzeLogicNode(fun.requires);
            if (fun.requires.inferredType !== 'boolean' && fun.requires.inferredType !== 'unknown') {
                this.reportError(`'requires' clause in function '${fun.name}' must be a boolean predicate`, fun.requires.position);
            }
        }

        // Анализ ensures (доступны параметры и возвращаемые значения)
        if (fun.ensures) {
            this.analyzeLogicNode(fun.ensures);
            if (fun.ensures.inferredType !== 'boolean' && fun.ensures.inferredType !== 'unknown') {
                this.reportError(`'ensures' clause in function '${fun.name}' must be a boolean predicate`, fun.ensures.position);
            }
        }

        // Тело функции
        this.analyzeStatement(fun.body);

        this.symbolTable.exitScope();
    }

    private analyzeStatement(statement: StatementNode) {
        switch (statement.type) {
            case "AssignmentStmt": {
                this.analyzeAssignment(statement);
                break;
            }
            case "IfStmt": {
                this.analyzeLogicNode(statement.condition);
                if (statement.condition.inferredType !== 'boolean' && statement.condition.inferredType !== 'unknown') {
                    this.reportError('If condition is not boolean', statement.position);
                }

                this.analyzeStatement(statement.thenBranch);
                if (statement.elseBranch) {
                    this.analyzeStatement(statement.elseBranch);
                }
                break;
            }
            case "WhileStmt": {
                this.analyzeLogicNode(statement.condition);
                if (statement.condition.inferredType !== 'boolean' && statement.condition.inferredType !== 'unknown') {
                    this.reportError('While condition is not boolean', statement.position);
                }

                if (statement.invariant) {
                    this.analyzeLogicNode(statement.invariant);
                    if (statement.invariant.inferredType !== 'boolean' && statement.invariant.inferredType !== 'unknown') {
                        this.reportError('While invariant is not boolean', statement.invariant.position);
                    }
                }

                this.analyzeStatement(statement.body);
                break;
            }
            case "BlockStmt": {
                this.symbolTable.enterScope();
                for (const s of statement.statements) {
                    this.analyzeStatement(s);
                }
                this.symbolTable.exitScope();
                break;
            }
            case "AssertStmt": {
                this.analyzeLogicNode(statement.predicate);
                if (statement.predicate.inferredType !== 'boolean' && statement.predicate.inferredType !== 'unknown') {
                    this.reportError('Assert predicate is not boolean', statement.position);
                }
                break;
            }
            case "AssumeStmt": {
                this.analyzeLogicNode(statement.predicate);
                if (statement.predicate.inferredType !== 'boolean' && statement.predicate.inferredType !== 'unknown') {
                    this.reportError('Assume predicate is not boolean', statement.position);
                }
                break;
            }
        }
    }

    private analyzeAssignment(assignment: AssignmentStmtNode) {
        if (assignment.targets.length === 0) {
            this.reportError("Assignment statement must have at least one target", assignment.position);
            return;
        }

        // 1. Случай вызова функции в правой части (кортежное присваивание)
        if (assignment.value.type === 'FunctionCall') {
            const funcCall = assignment.value;
            this.analyzeFunctionCall(funcCall);

            const funSym = this.symbolTable.lookup(funcCall.name);
            if (funSym && funSym.kind === 'Function') {
                const expectedReturns = funSym.node.returns;
                if (expectedReturns.length !== assignment.targets.length) {
                    this.reportError(
                        `Function '${funSym.name}' returns ${expectedReturns.length} value(s), but ${assignment.targets.length} target(s) were assigned`,
                        assignment.position
                    );
                    return;
                }

                for (let i = 0; i < assignment.targets.length; i++) {
                    const targetName = assignment.targets[i]!;
                    const returnType = expectedReturns[i]!.varType;
                    this.assignToTarget(targetName, returnType, assignment.position);
                }
            }
            return;
        }

        // 2. Обычное присваивание одиночного выражения
        if (assignment.targets.length !== 1) {
            this.reportError(
                `Cannot assign a single expression of type '${assignment.value.type}' to multiple targets`,
                assignment.position
            );
            return;
        }

        this.analyzeExpression(assignment.value);
        const valueType = assignment.value.inferredType ?? 'unknown';

        if (valueType !== 'unknown') {
            this.assignToTarget(assignment.targets[0]!, valueType as VarType, assignment.position);
        }
    }

    private assignToTarget(targetName: string, valueType: VarType, position: number) {
        const symbol = this.symbolTable.lookup(targetName);
        if (!symbol) {
            this.reportError(`Use of undeclared symbol '${targetName}'`, position);
            return;
        }

        if (symbol.kind === 'Parameter') {
            this.reportError(`Cannot assign to read-only parameter '${targetName}'`, position);
            return;
        }

        if (symbol.kind !== 'LocalVariable' && symbol.kind !== 'ReturnVariable' && symbol.kind !== 'Variable') {
            this.reportError(`Cannot assign to ${symbol.kind} '${targetName}'`, position);
            return;
        }

        const currentType = symbol.node.inferredType || symbol.node.varType;

        if (!currentType) {
            // Вывод типа для локальной переменной при первом корректном присваивании
            symbol.node.inferredType = valueType;
        } else if (currentType !== valueType) {
            this.reportError(
                `Type mismatch for target '${targetName}': expected '${currentType}', got '${valueType}'`,
                position
            );
        }
    }

    private analyzeExpression(expr: ExpressionNode) {
        switch (expr.type) {
            case 'Number': {
                expr.inferredType = 'int';
                break;
            }
            case 'VarRef': {
                const symbol = this.symbolTable.lookup(expr.name);
                if (!symbol) {
                    this.reportError(`Undeclared variable '${expr.name}'`, expr.position);
                    expr.inferredType = 'unknown';
                    break;
                }

                if (symbol.kind === 'Formula' || symbol.kind === 'Function') {
                    this.reportError(`Cannot use ${symbol.kind} '${expr.name}' as a variable`, expr.position);
                    expr.inferredType = 'unknown';
                    break;
                }

                const varType = symbol.node.inferredType || symbol.node.varType;
                if (!varType) {
                    this.reportError(`Variable '${expr.name}' used before its type could be inferred`, expr.position);
                    expr.inferredType = 'unknown';
                    break;
                }

                expr.inferredType = varType;
                break;
            }
            case 'BinaryExpr': {
                this.analyzeExpression(expr.left);
                this.analyzeExpression(expr.right);

                const leftType = expr.left.inferredType;
                const rightType = expr.right.inferredType;

                if (leftType !== 'unknown' && leftType !== 'int') {
                    this.reportError(`Left operand of '${expr.operator}' must be int, got ${leftType}`, expr.left.position);
                }
                if (rightType !== 'unknown' && rightType !== 'int') {
                    this.reportError(`Right operand of '${expr.operator}' must be int, got ${rightType}`, expr.right.position);
                }

                expr.inferredType = (leftType === 'unknown' || rightType === 'unknown') ? 'unknown' : 'int';
                break;
            }
            case 'UnaryExpr': {
                this.analyzeExpression(expr.operand);
                if (expr.operand.inferredType !== 'unknown' && expr.operand.inferredType !== 'int') {
                    this.reportError(`Operand of unary '${expr.operator}' must be int, got ${expr.operand.inferredType}`, expr.operand.position);
                }
                expr.inferredType = expr.operand.inferredType === 'unknown' ? 'unknown' : 'int';
                break;
            }
            case 'ArrayAccess': {
                this.analyzeExpression(expr.array);
                this.analyzeExpression(expr.index);

                if (expr.array.inferredType !== 'unknown' && expr.array.inferredType !== 'int[]') {
                    this.reportError(`Array access target must be 'int[]', got '${expr.array.inferredType}'`, expr.array.position);
                }
                if (expr.index.inferredType !== 'unknown' && expr.index.inferredType !== 'int') {
                    this.reportError(`Array index must be 'int', got '${expr.index.inferredType}'`, expr.index.position);
                }

                expr.inferredType = 'int';
                break;
            }
            case 'FunctionCall': {
                this.analyzeFunctionCall(expr);

                const funSym = this.symbolTable.lookup(expr.name);
                if (funSym && funSym.kind === 'Function') {
                    if (funSym.node.returns.length !== 1) {
                        this.reportError(
                            `Function '${expr.name}' returns ${funSym.node.returns.length} values and cannot be used inside an expression`,
                            expr.position
                        );
                        expr.inferredType = 'unknown';
                    } else {
                        expr.inferredType = funSym.node.returns[0]!.varType;
                    }
                } else {
                    expr.inferredType = 'unknown';
                }
                break;
            }
        }
    }

    private analyzeFunctionCall(call: FunctionCallNode) {
        const funSym = this.symbolTable.lookup(call.name);
        if (!funSym) {
            this.reportError(`Use of undeclared function '${call.name}'`, call.position);
            return;
        }

        if (funSym.kind !== 'Function') {
            this.reportError(`Symbol '${call.name}' is a ${funSym.kind}, not a Function`, call.position);
            return;
        }

        const params = funSym.node.params;
        if (params.length !== call.args.length) {
            this.reportError(
                `Function '${call.name}' expects ${params.length} argument(s), but got ${call.args.length}`,
                call.position
            );
        }

        const minLen = Math.min(params.length, call.args.length);
        for (let i = 0; i < minLen; i++) {
            this.analyzeExpression(call.args[i]!);
            const argType = call.args[i]!.inferredType;
            const paramType = params[i]!.varType;

            if (argType !== 'unknown' && argType !== paramType) {
                this.reportError(
                    `Argument ${i + 1} of '${call.name}' type mismatch: expected '${paramType}', got '${argType}'`,
                    call.args[i]!.position
                );
            }
        }
    }

    private analyzeLogicNode(logicNode: LogicNode) {
        switch (logicNode.type) {
            case 'BooleanLiteral': {
                logicNode.inferredType = 'boolean';
                break;
            }
            case 'Comparison': {
                this.analyzeExpression(logicNode.left);
                this.analyzeExpression(logicNode.right);

                if (logicNode.left.inferredType !== 'unknown' && logicNode.left.inferredType !== 'int') {
                    this.reportError(`Left operand of comparison '${logicNode.operator}' must be int`, logicNode.left.position);
                }
                if (logicNode.right.inferredType !== 'unknown' && logicNode.right.inferredType !== 'int') {
                    this.reportError(`Right operand of comparison '${logicNode.operator}' must be int`, logicNode.right.position);
                }

                logicNode.inferredType = 'boolean';
                break;
            }
            case 'BinaryLogic': {
                this.analyzeLogicNode(logicNode.left);
                this.analyzeLogicNode(logicNode.right);

                if (logicNode.left.inferredType !== 'unknown' && logicNode.left.inferredType !== 'boolean') {
                    this.reportError(`Left operand of '${logicNode.operator}' is not boolean`, logicNode.left.position);
                }
                if (logicNode.right.inferredType !== 'unknown' && logicNode.right.inferredType !== 'boolean') {
                    this.reportError(`Right operand of '${logicNode.operator}' is not boolean`, logicNode.right.position);
                }

                logicNode.inferredType = 'boolean';
                break;
            }
            case 'UnaryLogic': {
                this.analyzeLogicNode(logicNode.operand);
                if (logicNode.operand.inferredType !== 'unknown' && logicNode.operand.inferredType !== 'boolean') {
                    this.reportError(`Operand of '${logicNode.operator}' is not boolean`, logicNode.operand.position);
                }
                logicNode.inferredType = 'boolean';
                break;
            }
            case 'Quantifier': {
                this.symbolTable.enterScope();

                this.define({
                    kind: "Parameter",
                    node: logicNode.variable,
                    name: logicNode.variable.name,
                    position: logicNode.variable.position
                });

                this.analyzeLogicNode(logicNode.predicate);
                if (logicNode.predicate.inferredType !== 'boolean' && logicNode.predicate.inferredType !== 'unknown') {
                    this.reportError("Quantifier body must be a predicate", logicNode.position);
                }

                logicNode.inferredType = 'boolean';
                this.symbolTable.exitScope();
                break;
            }
            case 'FormulaRef': {
                const formulaSym = this.symbolTable.lookup(logicNode.name);
                if (!formulaSym) {
                    this.reportError(`Use of undeclared formula '${logicNode.name}'`, logicNode.position);
                    logicNode.inferredType = 'unknown';
                    break;
                }

                if (formulaSym.kind !== 'Formula') {
                    this.reportError(`Symbol '${logicNode.name}' is a ${formulaSym.kind}, not a Formula`, logicNode.position);
                    logicNode.inferredType = 'unknown';
                    break;
                }

                const params = formulaSym.node.params;
                if (params.length !== logicNode.args.length) {
                    this.reportError(
                        `Formula '${logicNode.name}' expects ${params.length} argument(s), got ${logicNode.args.length}`,
                        logicNode.position
                    );
                }

                const minLen = Math.min(params.length, logicNode.args.length);
                for (let i = 0; i < minLen; i++) {
                    this.analyzeExpression(logicNode.args[i]!);
                    const argType = logicNode.args[i]!.inferredType;
                    const paramType = params[i]!.varType;

                    if (argType !== 'unknown' && argType !== paramType) {
                        this.reportError(
                            `Argument ${i + 1} of formula '${logicNode.name}' mismatch: expected '${paramType}', got '${argType}'`,
                            logicNode.args[i]!.position
                        );
                    }
                }

                logicNode.inferredType = 'boolean';
                break;
            }
        }
    }

    private define(symbol: Symbol) {
        if (!this.symbolTable.define(symbol)) {
            this.reportError(`Redefinition of ${symbol.kind}: ${symbol.name}`, symbol.position);
        }
    }

    private reportError(message: string, position: number) {
        this.errors.push({ message, position });
    }
}