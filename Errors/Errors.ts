export class ParseError extends Error {
    constructor(message: string, public position: number) {
        super(`ParseError: ${message} at position ${position}`)
        this.name = message
    }
}


export class SemanticCheckError extends Error {
    constructor(message: string, public position: number) {
        super(`TypeError: ${message} at position ${position}`)
        this.name = message
    }
}
