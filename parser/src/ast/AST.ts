export interface Position {
    position: number;
}

export interface SourcePosition {
    position: number;
}

export type VarType = 'int' | 'int[]'

export interface VarDef {
    name: string;
    varType: VarType;
}

export interface LocalVarDef {
    name: string;
    varType: VarType;
}

// --- Expressions ---

export interface NumberNode extends Position {
    type: "Number";
    value: number;
}

export interface ArrayAccessNode extends Position {
    type: "ArrayAccess";
    arrayName: string;
    index: ExpressionNode;
}

export interface FunctionCallNode extends Position {
    type: "FunctionCall";
    name: string;
    args: ExpressionNode[];
}

export interface VarRefNode extends Position {
    type: "VarRef";
    name: string;
}

export interface UnaryExprDotNode extends Position {
    type: "UnaryExprDot";
    operator: "-";
    argument: ExpressionNode;
}

export type ExpressionNode = 
      FunctionCallNode
    | ArrayAccessNode
    | NumberNode
    | VarRefNode
    | UnaryExprDotNode
    | BinaryExpr;
    

export interface FunctionDeclNode extends SourcePosition {
    type: 'FunctionDecl',
    name: string,
    params: VarDef,

}

export interface FormulaDeclNode extends SourcePosition {
    type: 'FormulaDecl',

}