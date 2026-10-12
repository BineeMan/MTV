import { lookup } from "node:dns";
import { SemanticCheckError } from "../../../Errors/Errors.js";
import type { AssignmentStmtNode, ExpressionNode, FunctionDeclNode, IfStmtNode, ModuleNode, StatementNode, VarType } from "../../../parser/src/Ast/AstNodes.js";
import type { SemanticError } from "./SemanticError.js";
import { SymbolTable } from "./SymbolTable.js";
import type { Symbol } from "./Symbols.js";

export class SemanticAnalyzer {
    private symbolTable = new SymbolTable()

    private globalSymbols = new Map<string, Symbol>;

    private errors: SemanticError[] = []

    public analyzeAndInferModule(module: ModuleNode): SemanticError[] {
        this.errors = []
        this.globalSymbols = new Map<string, Symbol>;

        for (const fun of module.functions) {
            if (this.globalSymbols.has(fun.name)) {
                this.reportError(`Redefinition of function ${fun.name}`, fun.position)
                continue
            }
            this.globalSymbols.set(fun.name, { name: fun.name, kind: "Function", position: fun.position, node: fun })
        }

        for (const fun of module.functions) {
            this.analyzeFunction(fun);
        }

        return this.errors
    }

    private analyzeFunction(fun: FunctionDeclNode) {
        this.symbolTable.enterScope()
        for (const varDef of fun.params) {
            if (varDef.varType === undefined) {
                throw new SemanticCheckError(`varDef.varType === undefined for ${varDef.name}`, varDef.position)
            }
            this.define({ name: varDef.name, kind: "Parameter", position: varDef.position, node: varDef })
        }

        for (const varDef of fun.uses) {
            this.define({ name: varDef.name, kind: "Variable", position: varDef.position, node: varDef })
        }

        for (const varDef of fun.returns) {
            this.define({ name: varDef.name, kind: "Variable", position: varDef.position, node: varDef })
        }

        this.analyzeStatement(fun.body)

        this.symbolTable.exitScope()
    }

    private analyzeStatement(statement: StatementNode) {
        switch (statement.type) {
            case "BlockStmt": {
                this.symbolTable.enterScope()
                for (const s of statement.statements) {
                    this.analyzeStatement(s)
                }
                this.symbolTable.exitScope()
                break
            }
            case "AssignmentStmt": {
                this.analyzeAssignment(statement)
                break
            }
            case "IfStmt": {
                this.analyzeIfStmt(statement)
                break
            }
            case "WhileStmt": {
                this.analyzeWhileStmt(statement)
                break
            }
            case "BlockStmt":
                this.symbolTable.enterScope()

                for (const s of statement.statements) {
                    this.analyzeStatement(s)
                }

                this.symbolTable.exitScope()
                break;
            case "AssertStmt":
                this.analyzeLogicStmt(statement)
                break;
            case "AssumeStmt":
                this.analyzeLogicStmt(statement)
                break;
        }
    }

    private analyzeAssignment(assignment: AssignmentStmtNode) {
        if (assignment.targets.length == 0) {
            throw new SemanticCheckError(`statement.targets.length == 0 for statement`, assignment.position)
        }

        this.analyzeExpression(assignment.value);

        if (assignment.value.type === 'FunctionCall') {
            const funSym = this.symbolTable.lookup(assignment.value.name)
            if (funSym && funSym.kind === 'Function') {
                const expectedReturns = funSym.node.returns
                if (expectedReturns.length !== assignment.targets.length) {
                    this.reportError(
                        `Function '${funSym.name}' returns ${expectedReturns.length} value(s), but ${assignment.targets.length} target(s) were assigned`,
                        assignment.position
                    );
                }

                assignment.targets.forEach((target, index) => {
                    const targetSym = this.symbolTable.lookup(target)
                    const expectedType = funSym.node.returns[index]?.varType
                    if (targetSym && (targetSym.kind === 'Parameter' || targetSym.kind === 'Variable')) {
                        if (funSym && expectedType !== targetSym.node.varType) {
                            this.reportError(
                                `Type mismatch for target '${target}': expected '${expectedType}', got '${targetSym.varType}'`,
                                assignment.position
                            );
                        }
                    }
                })
            }
        }
        else {

        }

    }


    private checkAndReport(predicate: boolean, msg: string, position: number) {
        if (predicate) {
            this.reportError(msg, position);
        }
    }

    private analyzeExpression(expr: ExpressionNode) {
        switch (expr.type) {
            case 'Number': {
                return 'int'
            }
            case 'VarRef': {
                const symbol = this.symbolTable.lookup(expr.name)
                if (!symbol) {
                    this.reportError(`Undeclared variable '${expr.name}'`, expr.position);
                    expr.inferredType = 'int'
                    break;
                }

                if (symbol.kind === 'Formula' || symbol.kind === 'Function') {
                    this.reportError(`Cannot use ${symbol.kind} '${expr.name}' as a variable`, expr.position);
                    expr.inferredType = 'int';
                    break;
                }

                if (!symbol.varType) {
                    throw new SemanticCheckError(`symbol ${symbol.name} does not have varType`, symbol.position)
                }
                expr.inferredType = symbol.varType!
                break
            }
            case "ArrayAccess": {

            }
        }
    }

    private define(symbol: Symbol) {
        if (!this.symbolTable.define(symbol)) {
            this.reportError(`Redefenition of ${symbol.kind}: ${symbol.name}`, symbol.position)
        }

    }
    private reportError(message: string, position: number) {
        this.errors.push({ message, position });
    }
}