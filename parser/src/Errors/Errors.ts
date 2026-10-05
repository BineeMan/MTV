export class ParseError extends Error {
    constructor(message: string, public position: number) {
        super(`${message} at position ${position}`)
        this.name = message
    }
}