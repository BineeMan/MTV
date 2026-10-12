import { lookup } from "node:dns";
import { SemanticCheckError } from "../../../Errors/Errors.js";
import type { AssignmentStmtNode, ExpressionNode, FunctionCallNode, FunctionDeclNode, IfStmtNode, ModuleNode, StatementNode, VarType } from "../../../parser/src/Ast/AstNodes.js";
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
            this.define({ name: varDef.name, kind: "LocalVariable", position: varDef.position, node: varDef })
        }

        for (const varDef of fun.uses) {
            this.define({ name: varDef.name, kind: "LocalVariable", position: varDef.position, node: varDef })
        }

        for (const varDef of fun.returns) {
            this.define({ name: varDef.name, kind: "LocalVariable", position: varDef.position, node: varDef })
        }

        this.analyzeStatement(fun.body)

        this.symbolTable.exitScope()
    }

    private analyzeStatement(statement: StatementNode) {
        switch (statement.type) {
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
                        `Function '${funSym.name}' returns ${expectedReturns.length} 
                        value(s), but ${assignment.targets.length} target(s) were assigned`,
                        assignment.position
                    );
                }
                else {
                    const length = assignment.targets.length

                    for (let i = 0; i < length; i++) {
                        const targetSymbol = this.symbolTable.lookup(assignment.targets[i]!)
                        const returnVarDef = funSym.node.returns[i]
                        if (returnVarDef === undefined) {
                            throw new SemanticCheckError("returnVarDef === undefined", assignment.position)
                        }

                        if (targetSymbol === undefined) {
                            this.reportError(`Assignement of an undeclared variable ${assignment.targets[i]}`,
                                assignment.position)
                            continue
                        }

                        if (targetSymbol.kind === 'LocalVariable' || targetSymbol.kind === 'Variable') {
                            targetSymbol.node.inferredType =
                                targetSymbol.node.inferredType || targetSymbol.node.varType || returnVarDef.varType

                            if (targetSymbol.node.inferredType !== returnVarDef.varType) {
                                this.reportError(`Type mismatch ${targetSymbol.node} of type ${targetSymbol.node.inferredType}. Expected ${returnVarDef.varType}`,
                                    assignment.position)
                            }
                        }
                        else {
                            this.reportError(`Cannot assign to ${targetSymbol.name} of type ${targetSymbol.kind}`,
                                assignment.position)
                        }


                    }
                }
            }
        }
        else {
            if (assignment.targets.length !== 1) {
                this.reportError(
                    `Cannot assign a single expression of type '${assignment.value.type}' to multiple targets`,
                    assignment.position
                );
            }
            // Single assignment check
            else {
                const singleSymbol = this.symbolTable.lookup(assignment.targets[0]!)
                if (singleSymbol === undefined) {
                    this.reportError(`Undeclared symbol ${assignment.targets[0]!}`, assignment.position)
                    return
                }

                if (singleSymbol.kind === 'LocalVariable' || singleSymbol.kind === 'Variable') {
                    if (assignment.value.inferredType == undefined) {
                        throw new SemanticCheckError("assignment.value.inferredType == undefined", assignment.position)
                    }
                    singleSymbol.node.inferredType =
                        singleSymbol.node.inferredType || singleSymbol.node.varType || assignment.value.inferredType

                    if (assignment.value.inferredType !== singleSymbol.node.inferredType) {
                        this.reportError(
                            `Type mismatch for target '${singleSymbol.name}': 
                                expected '${singleSymbol.node.inferredType}', got '${assignment.value.inferredType}'`,
                            assignment.position
                        );
                    }
                }
                else {
                    this.reportError(`Cannot assign to ${singleSymbol.name} of type ${singleSymbol.kind}`,
                        assignment.position)
                }
            }
        }
    }


    private checkAndReport(predicate: boolean, msg: string, position: number) {
        if (predicate) {
            this.reportError(msg, position);
        }
    }

    private assert(predicate: boolean, msg: string, position: number) {
        if (!predicate) {
            throw new SemanticCheckError(msg, position)
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
                    break;
                }

                if (symbol.kind === 'Formula' || symbol.kind === 'Function') {
                    this.reportError(`Cannot use ${symbol.kind} '${expr.name}' as a variable`, expr.position);
                    break;
                }

                if (symbol.kind === 'Variable') {
                    expr.inferredType = symbol.node.varType
                }
                else if (symbol.kind === 'LocalVariable') {
                    if (symbol.node.inferredType === undefined) {
                        throw new SemanticCheckError(`LocalVariable ${symbol.name} does not have inferredType`, symbol.position)
                    }
                    expr.inferredType = symbol.node.inferredType
                }

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