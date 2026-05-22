"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
exports.logger = {
    info: (msg, meta) => {
        console.log(`\x1b[32m[INFO]\x1b[0m ${msg}`, meta || '');
    },
    warn: (msg, meta) => {
        console.warn(`\x1b[33m[WARN]\x1b[0m ${msg}`, meta || '');
    },
    error: (msg, meta) => {
        console.error(`\x1b[31m[ERROR]\x1b[0m ${msg}`, meta || '');
    },
    debug: (msg, meta) => {
        if (process.env.DEBUG === 'true') {
            console.debug(`\x1b[90m[DEBUG]\x1b[0m ${msg}`, meta || '');
        }
    }
};
//# sourceMappingURL=logger.js.map