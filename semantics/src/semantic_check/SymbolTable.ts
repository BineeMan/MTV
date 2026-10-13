import type { Symbol } from "./Symbols.js";

export class SymbolTable {
    private scopes: Map<string, Symbol>[] = []

    public enterScope() {
        this.scopes.push(new Map())
    }

    public exitScope() {
        if (this.scopes.length > 1) {
            this.scopes.pop()
        }
    }

    public clear() {
        this.scopes.length = 0
    }

    public define(symbol: Symbol) : boolean {
        const currentScope = this.scopes[this.scopes.length - 1]
        if (!currentScope) {
            throw new Error("No active scope")
        }

        if (currentScope!.has(symbol.name)) {
            return false
        }
        currentScope!.set(symbol.name, symbol)
        return true
    }

    public lookup(name: string) : Symbol | undefined {
        for (let i = this.scopes.length - 1; i >= 0; i--) {
            const sym = this.scopes[i]?.get(name)
            if (sym) {
                return sym
            }
        }
        return undefined
    }

    public doesExist(name: string) {
        for (let i = this.scopes.length - 1; i >= 0; i--) {
            const sym = this.scopes[i]?.get(name)
            if (sym) {
                return true
            }
        }
        return false
    }
}