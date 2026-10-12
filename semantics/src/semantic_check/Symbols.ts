import type { FormulaDeclNode, FunctionDeclNode, LocalVarDef, VarDef as VarDefNode, VarType } from "../../../parser/src/Ast/AstNodes.js";

export interface LocalVarSymbol {
    kind: "LocalVariable";
    node: LocalVarDef;
    name: string;
    position: number;
}

export interface VariableSymbol {
    kind: "Variable";
    node: VarDefNode;
    name: string;
    position: number;
}

export interface FunctionSymbol {
    kind: "Function";
    node: FunctionDeclNode;
    name: string;
    position: number;
}

export interface FormulaSymbol {
    kind: "Formula";
    node: FormulaDeclNode;
    name: string;
    position: number;
}

export type Symbol = LocalVarSymbol | FunctionSymbol | FormulaSymbol | VariableSymbol;
