import { fail, main } from './cli';

try {
    main();
} catch (err) {
    fail(err as Error);
}
