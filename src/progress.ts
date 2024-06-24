export function textProgressBar(progress: number, width: number) {
    const proportionDone = Math.max(0, Math.min(progress, 1)) * width;
    const numFullBlocks = Math.floor(proportionDone);
    let barString = '\u2588'.repeat(proportionDone);
    if (numFullBlocks < width) {
        // -1 for "none", 0-6 for block fractions. This should never be 7 because proportionDone - numFullBlocks
        // will never reach 1.
        const fractionalBlock = Math.floor((proportionDone - numFullBlocks) * 8) - 1;
        const fractionalBlockChar = fractionalBlock === -1 ?
            ' ' :
            String.fromCharCode(0x258f - fractionalBlock);
        barString += fractionalBlockChar;
        barString += '░'.repeat(width - (numFullBlocks + 1));
    }
    return barString;
}

export function logUpdate() {
    let prevLen = 0;
    let timeout: NodeJS.Timeout | undefined;
    let curText = '';

    function doPrint(text: string) {
        //process.stdout.clearLine(0);
        process.stdout.cursorTo(0);
        process.stdout.write(text);
        if (text.length < prevLen) process.stdout.write(' '.repeat(prevLen - text.length));
        //process.stdout.cursorTo(text.length);

        prevLen = text.length;
    }

    return {
        print(text: string) {
            curText = text;
            if (!timeout) timeout = setTimeout(() => {
                doPrint(curText);
                timeout = undefined;
            }, 1000 / 30);
        },
        stop() {
            if (timeout) doPrint(curText);
            clearTimeout(timeout);
            process.stdout.write('\n');
        },
    };
}
