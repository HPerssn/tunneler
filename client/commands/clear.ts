import { RequestStorage } from '../storage.js';

export async function clearCommand(args: string[]) {
    const storage = new RequestStorage('./requests.db');

    console.log('Clearing all requests...');
    storage.clearAll();
    console.log('Done.');

    storage.close();
}
