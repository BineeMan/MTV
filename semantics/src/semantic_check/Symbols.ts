import type { FormulaDeclNode, FunctionDeclNode, LocalVarDef, VarDef as VarDefNode, VarType } from "../../../parser/src/Ast/AstNodes.js";

export interface VarSymbol {
    kind: "Variable" | "Parameter";
    node: VarDefNode | LocalVarDef;
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

export type Symbol = VarSymbol | FunctionSymbol | FormulaSymbol;
